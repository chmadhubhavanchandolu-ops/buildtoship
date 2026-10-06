import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, conversationMessagesTable, conversationsTable } from "@workspace/db";
import {
  ChatWithSupportAiBody,
  ChatWithSupportAiResponse,
  CreateConversationBody,
  CreateConversationResponse,
  EscalateConversationBody,
  EscalateConversationParams,
  EscalateConversationResponse,
  GetConversationMessagesParams,
  GetConversationMessagesResponse,
  GetConversationParams,
  GetConversationResponse,
  GetConversationsQueryParams,
  GetConversationsResponse,
  SendConversationMessageBody,
  SendConversationMessageParams,
  SendConversationMessageResponse,
  UpdateConversationBody,
  UpdateConversationParams,
  UpdateConversationResponse,
} from "@workspace/api-zod";
import {
  createAgentReply,
  createCustomerConversation,
  escalateConversation,
  sendCustomerMessage,
} from "../lib/conversation-service";
import {
  getConversationDetail,
  getConversationRecord,
  listConversationRecords,
  mapConversationSummaries,
} from "../lib/support-data";
import {
  mayAccessConversation,
  requireSession,
} from "../lib/session";

const router: IRouter = Router();
const agentRoles = ["agent", "admin"] as const;

function parseId(params: unknown, schema: typeof GetConversationParams) {
  return schema.safeParse(params);
}

router.get("/conversations", async (req, res): Promise<void> => {
  const user = await requireSession(req, res);
  if (!user) return;
  const query = GetConversationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let records = await listConversationRecords();
  if (user.role === "customer") {
    records = records.filter((record) => record.customerId === user.id);
  }
  if (query.data.status) {
    records = records.filter((record) => record.status === query.data.status);
  }
  if (query.data.priority) {
    records = records.filter((record) => record.priority === query.data.priority);
  }

  let conversations = await mapConversationSummaries(records);
  const search = query.data.search?.trim().toLowerCase();
  if (search) {
    conversations = conversations.filter((conversation) =>
      [
        conversation.customerName,
        conversation.customerEmail,
        conversation.lastMessage,
        conversation.summary,
        conversation.intent,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search)),
    );
  }
  const start = (query.data.page - 1) * query.data.limit;
  res.json(GetConversationsResponse.parse(conversations.slice(start, start + query.data.limit)));
});

router.post("/conversations", async (req, res): Promise<void> => {
  const user = await requireSession(req, res, ["customer"]);
  if (!user) return;
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const content = parsed.data.message.trim();
  if (!content) {
    res.status(400).json({ error: "Enter a message before sending." });
    return;
  }

  const result = await createCustomerConversation(user, content);
  const detail = await getConversationDetail(result.conversation.id);
  res
    .status(201)
    .json(CreateConversationResponse.parse(detail));
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const params = parseId(req.params, GetConversationParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await requireSession(req, res);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  if (!mayAccessConversation(user, record.customerId)) {
    res.status(403).json({ error: "You can only view your own conversations." });
    return;
  }
  const detail = await getConversationDetail(record.id);
  res.json(GetConversationResponse.parse(detail));
});

router.patch("/conversations/:id", async (req, res): Promise<void> => {
  const params = UpdateConversationParams.safeParse(req.params);
  const body = UpdateConversationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request.",
    });
    return;
  }
  const user = await requireSession(req, res);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  if (!mayAccessConversation(user, record.customerId)) {
    res.status(403).json({ error: "You can only update your own conversations." });
    return;
  }
  if (
    user.role === "customer" &&
    (body.data.status !== "resolved" || body.data.priority !== undefined)
  ) {
    res.status(403).json({ error: "Customers can only close their own conversations." });
    return;
  }
  const changes: Partial<typeof conversationsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.data.status) {
    changes.status = body.data.status;
    if (body.data.status === "resolved") {
      changes.resolvedAt = new Date();
      changes.aiResolved = false;
    } else {
      changes.resolvedAt = null;
      changes.aiResolved = false;
    }
  }
  if (body.data.priority) changes.priority = body.data.priority;
  await db
    .update(conversationsTable)
    .set(changes)
    .where(eq(conversationsTable.id, record.id));
  const [updated] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, record.id))
    .limit(1);
  const [summary] = await mapConversationSummaries([updated]);
  res.json(UpdateConversationResponse.parse(summary));
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = GetConversationMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await requireSession(req, res);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  if (!mayAccessConversation(user, record.customerId)) {
    res.status(403).json({ error: "You can only view your own conversations." });
    return;
  }
  const messages = await db
    .select()
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.conversationId, record.id))
    .orderBy(conversationMessagesTable.createdAt);
  res.json(
    GetConversationMessagesResponse.parse(
      messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        senderType: message.senderType,
        senderName: message.senderName,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        confidence: message.confidence,
        helpful: message.helpful,
      })),
    ),
  );
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendConversationMessageParams.safeParse(req.params);
  const body = SendConversationMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request.",
    });
    return;
  }
  const user = await requireSession(req, res);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  if (!mayAccessConversation(user, record.customerId)) {
    res.status(403).json({ error: "You can only reply to your own conversations." });
    return;
  }
  const content = body.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Enter a message before sending." });
    return;
  }

  if (user.role === "customer") {
    const result = await sendCustomerMessage(record, user, content);
    res.json(SendConversationMessageResponse.parse(result));
    return;
  }
  if (!agentRoles.includes(user.role as (typeof agentRoles)[number])) {
    res.status(403).json({ error: "Only agents can reply to a support ticket." });
    return;
  }
  const result = await createAgentReply(record, user, content);
  res.json(SendConversationMessageResponse.parse(result));
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const user = await requireSession(req, res, ["customer"]);
  if (!user) return;
  const parsed = ChatWithSupportAiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const content = parsed.data.message.trim();
  if (!content) {
    res.status(400).json({ error: "Enter a message before sending." });
    return;
  }
  const result = await createCustomerConversation(user, content);
  res.json(ChatWithSupportAiResponse.parse(result));
});

router.post("/conversations/:id/escalate", async (req, res): Promise<void> => {
  const params = EscalateConversationParams.safeParse(req.params);
  const body = EscalateConversationBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request.",
    });
    return;
  }
  const user = await requireSession(req, res);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  if (!mayAccessConversation(user, record.customerId)) {
    res.status(403).json({ error: "You can only escalate your own conversations." });
    return;
  }
  const reason =
    body.data.reason?.trim() ||
    "The customer requested a human support agent.";
  await escalateConversation(record, reason);
  const detail = await getConversationDetail(record.id);
  res.json(EscalateConversationResponse.parse(detail));
});

export default router;
