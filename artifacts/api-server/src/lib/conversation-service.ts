import { randomBytes, randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversationMessagesTable,
  conversationsTable,
  knowledgeArticlesTable,
  supportSettingsTable,
  type ConversationRecord,
  type SupportUser,
} from "@workspace/db";
import { classifyPriority, decideSupportReply } from "./support-ai";
import { mapConversationSummaries } from "./support-data";

function ticketNumber(): string {
  return `SD-${Date.now().toString().slice(-8)}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function makeSummary(message: string): string {
  const concise = message.trim().replace(/\s+/g, " ");
  return `Customer issue: ${concise.length > 190 ? `${concise.slice(0, 187)}…` : concise}`;
}

function stamp(date: Date): string {
  return date.toISOString();
}

function toMessage(
  message: typeof conversationMessagesTable.$inferSelect,
) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderType: message.senderType,
    senderName: message.senderName,
    content: message.content,
    createdAt: stamp(message.createdAt),
    confidence: message.confidence,
    helpful: message.helpful,
  };
}

async function saveCustomerMessage(
  conversationId: string,
  customer: SupportUser,
  content: string,
) {
  const [message] = await db
    .insert(conversationMessagesTable)
    .values({
      id: randomUUID(),
      conversationId,
      senderType: "customer",
      senderName: customer.name,
      content,
    })
    .returning();
  return message;
}

async function saveAiMessage(
  conversationId: string,
  content: string,
  confidence: number,
) {
  const [message] = await db
    .insert(conversationMessagesTable)
    .values({
      id: randomUUID(),
      conversationId,
      senderType: "ai",
      senderName: "SupportDesk AI",
      content,
      confidence,
    })
    .returning();
  return message;
}

async function updateAfterAi(
  record: ConversationRecord,
  customerMessage: string,
) {
  const [articles, [settings]] = await Promise.all([
    db.select().from(knowledgeArticlesTable),
    db
      .select()
      .from(supportSettingsTable)
      .where(eq(supportSettingsTable.id, 1))
      .limit(1),
  ]);
  const decision = await decideSupportReply(
    customerMessage,
    articles,
    settings?.confidenceThreshold ?? 0.72,
  );
  const updatedAt = new Date();
  const updatedStatus = decision.escalated ? "waiting_for_agent" : "resolved";
  const [updatedRecord] = await db
    .update(conversationsTable)
    .set({
      status: updatedStatus,
      priority:
        record.priority === "low"
          ? classifyPriority(customerMessage)
          : record.priority,
      aiConfidence: decision.confidence,
      escalationReason: decision.escalationReason,
      intent: decision.intent,
      summary: decision.escalated ? makeSummary(customerMessage) : null,
      recommendedNextAction: decision.escalated
        ? decision.recommendedNextAction
        : null,
      ticketNumber: decision.escalated
        ? record.ticketNumber ?? ticketNumber()
        : record.ticketNumber,
      aiResolved: !decision.escalated,
      updatedAt,
      resolvedAt: decision.escalated ? null : updatedAt,
    })
    .where(eq(conversationsTable.id, record.id))
    .returning();

  const aiMessage = await saveAiMessage(
    record.id,
    decision.answer,
    decision.confidence,
  );
  const [conversation] = await mapConversationSummaries([updatedRecord]);
  return {
    conversation,
    customerMessage: null,
    aiMessage: toMessage(aiMessage),
    escalated: decision.escalated,
    escalationReason: decision.escalationReason,
    aiMode: decision.aiMode,
  };
}

export async function createCustomerConversation(
  customer: SupportUser,
  content: string,
) {
  const now = new Date();
  const [record] = await db
    .insert(conversationsTable)
    .values({
      id: `conversation-${randomUUID()}`,
      customerId: customer.id,
      status: "ai_handling",
      priority: classifyPriority(content),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const customerMessage = await saveCustomerMessage(record.id, customer, content);
  const result = await updateAfterAi(record, content);
  return {
    ...result,
    customerMessage: toMessage(customerMessage),
  };
}

export async function sendCustomerMessage(
  record: ConversationRecord,
  customer: SupportUser,
  content: string,
) {
  const customerMessage = await saveCustomerMessage(record.id, customer, content);
  const stillAssigned =
    record.status === "waiting_for_agent" ||
    record.status === "assigned" ||
    record.status === "in_progress";

  if (stillAssigned) {
    const updatedAt = new Date();
    const [updatedRecord] = await db
      .update(conversationsTable)
      .set({ updatedAt })
      .where(eq(conversationsTable.id, record.id))
      .returning();
    const [conversation] = await mapConversationSummaries([updatedRecord]);
    return {
      conversation,
      customerMessage: toMessage(customerMessage),
      aiMessage: null,
      escalated: true,
      escalationReason: record.escalationReason,
      aiMode: "knowledge_base" as const,
    };
  }

  const processRecord =
    record.status === "resolved"
      ? { ...record, status: "ai_handling" as const, aiResolved: false }
      : record;
  return updateAfterAi(processRecord, content).then((result) => ({
    ...result,
    customerMessage: toMessage(customerMessage),
  }));
}

export async function escalateConversation(
  record: ConversationRecord,
  reason: string,
) {
  const [messages] = await Promise.all([
    db
      .select()
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, record.id))
      .orderBy(desc(conversationMessagesTable.createdAt)),
  ]);
  const latestCustomerMessage = messages.find((message) => message.senderType === "customer");
  const updatedAt = new Date();
  const [updatedRecord] = await db
    .update(conversationsTable)
    .set({
      status: "waiting_for_agent",
      priority:
        record.priority === "low" && latestCustomerMessage
          ? classifyPriority(latestCustomerMessage.content)
          : record.priority,
      escalationReason: reason,
      summary: record.summary ?? makeSummary(latestCustomerMessage?.content ?? reason),
      recommendedNextAction:
        "Review the conversation and verify account-specific details before replying.",
      ticketNumber: record.ticketNumber ?? ticketNumber(),
      aiResolved: false,
      resolvedAt: null,
      updatedAt,
    })
    .where(eq(conversationsTable.id, record.id))
    .returning();

  const [lastMessage] = messages;
  if (lastMessage?.senderType !== "ai" || !lastMessage.content.includes("sent it to a support agent")) {
    await saveAiMessage(
      record.id,
      "Your request has been forwarded to a human support agent. Please wait while an agent reviews your issue.",
      record.aiConfidence ?? 0,
    );
  }

  const [conversation] = await mapConversationSummaries([updatedRecord]);
  return conversation;
}

export async function createAgentReply(
  record: ConversationRecord,
  agent: SupportUser,
  content: string,
) {
  const now = new Date();
  const [message] = await db
    .insert(conversationMessagesTable)
    .values({
      id: randomUUID(),
      conversationId: record.id,
      senderType: "agent",
      senderName: agent.name,
      content,
    })
    .returning();

  const [updatedRecord] = await db
    .update(conversationsTable)
    .set({
      status: "in_progress",
      assignedAgentId: record.assignedAgentId ?? agent.id,
      ticketNumber: record.ticketNumber ?? ticketNumber(),
      escalationReason: record.escalationReason ?? "A support agent took over the conversation.",
      aiResolved: false,
      resolvedAt: null,
      updatedAt: now,
    })
    .where(eq(conversationsTable.id, record.id))
    .returning();
  const [conversation] = await mapConversationSummaries([updatedRecord]);
  return {
    conversation,
    customerMessage: toMessage(message),
    aiMessage: null,
    escalated: false,
    escalationReason: null,
    aiMode: "knowledge_base" as const,
  };
}
