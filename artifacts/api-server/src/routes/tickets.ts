import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, conversationsTable, internalNotesTable, supportUsersTable } from "@workspace/db";
import {
  AddTicketNoteBody,
  AddTicketNoteParams,
  AddTicketNoteResponse,
  GetTicketParams,
  GetTicketResponse,
  GetTicketsQueryParams,
  GetTicketsResponse,
  UpdateTicketBody,
  UpdateTicketParams,
  UpdateTicketResponse,
} from "@workspace/api-zod";
import { getConversationDetail, getConversationRecord, listConversationRecords, mapConversationSummaries } from "../lib/support-data";
import { requireSession } from "../lib/session";
import { randomBytes } from "node:crypto";

const router: IRouter = Router();
const agentRoles = ["agent", "admin"] as const;

function makeTicketNumber(): string {
  return `SD-${Date.now().toString().slice(-8)}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

router.get("/tickets", async (req, res): Promise<void> => {
  const user = await requireSession(req, res);
  if (!user) return;
  const query = GetTicketsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let records = (await listConversationRecords()).filter((record) => record.ticketNumber !== null);
  if (user.role === "customer") {
    records = records.filter((record) => record.customerId === user.id);
  }
  if (query.data.status) {
    records = records.filter((record) => record.status === query.data.status);
  }
  if (query.data.priority) {
    records = records.filter((record) => record.priority === query.data.priority);
  }
  let tickets = (await mapConversationSummaries(records)).map((ticket) => {
    const record = records.find((item) => item.id === ticket.id);
    return {
      ...ticket,
      ticketNumber: record?.ticketNumber ?? "",
      waitingSince: record?.createdAt.toISOString() ?? ticket.createdAt,
    };
  });
  const search = query.data.search?.trim().toLowerCase();
  if (search) {
    tickets = tickets.filter((ticket) =>
      [
        ticket.ticketNumber,
        ticket.customerName,
        ticket.customerEmail,
        ticket.lastMessage,
        ticket.summary,
        ticket.intent,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search)),
    );
  }
  res.json(GetTicketsResponse.parse(tickets));
});

router.get("/tickets/:id", async (req, res): Promise<void> => {
  const params = GetTicketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await requireSession(req, res);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record || !record.ticketNumber) {
    res.status(404).json({ error: "Support ticket not found." });
    return;
  }
  if (user.role === "customer" && user.id !== record.customerId) {
    res.status(403).json({ error: "You can only view your own tickets." });
    return;
  }
  const detail = await getConversationDetail(record.id);
  res.json(
    GetTicketResponse.parse({
      ...detail,
      ticketNumber: record.ticketNumber,
      waitingSince: record.createdAt.toISOString(),
    }),
  );
});

router.patch("/tickets/:id", async (req, res): Promise<void> => {
  const params = UpdateTicketParams.safeParse(req.params);
  const body = UpdateTicketBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request.",
    });
    return;
  }
  const user = await requireSession(req, res, agentRoles);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record || !record.ticketNumber) {
    res.status(404).json({ error: "Support ticket not found." });
    return;
  }

  let assignedAgentId = body.data.takeOver ? user.id : body.data.assignedAgentId;
  if (assignedAgentId) {
    const [assignee] = await db
      .select()
      .from(supportUsersTable)
      .where(eq(supportUsersTable.id, assignedAgentId))
      .limit(1);
    if (!assignee || !["agent", "admin"].includes(assignee.role)) {
      res.status(400).json({ error: "Choose an active support agent." });
      return;
    }
  }

  const status =
    body.data.takeOver
      ? "in_progress"
      : body.data.status;
  const changes: Partial<typeof conversationsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (status) {
    changes.status = status;
    changes.resolvedAt = status === "resolved" ? new Date() : null;
    if (status === "resolved") changes.aiResolved = false;
  }
  if (body.data.priority) changes.priority = body.data.priority;
  if (body.data.takeOver || body.data.assignedAgentId !== undefined) {
    changes.assignedAgentId = assignedAgentId ?? null;
  }
  await db
    .update(conversationsTable)
    .set(changes)
    .where(eq(conversationsTable.id, record.id));
  const updatedRecord = await getConversationRecord(record.id);
  if (!updatedRecord) {
    res.status(404).json({ error: "Support ticket not found." });
    return;
  }
  const detail = await getConversationDetail(record.id);
  res.json(
    UpdateTicketResponse.parse({
      ...detail,
      ticketNumber: updatedRecord.ticketNumber,
      waitingSince: updatedRecord.createdAt.toISOString(),
    }),
  );
});

router.post("/tickets/:id/notes", async (req, res): Promise<void> => {
  const params = AddTicketNoteParams.safeParse(req.params);
  const body = AddTicketNoteBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request.",
    });
    return;
  }
  const user = await requireSession(req, res, agentRoles);
  if (!user) return;
  const record = await getConversationRecord(params.data.id);
  if (!record || !record.ticketNumber) {
    res.status(404).json({ error: "Support ticket not found." });
    return;
  }
  const content = body.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Internal notes cannot be empty." });
    return;
  }
  const [note] = await db
    .insert(internalNotesTable)
    .values({
      id: `note-${randomBytes(12).toString("hex")}`,
      conversationId: record.id,
      authorName: user.name,
      content,
    })
    .returning();
  res.status(201).json(
    AddTicketNoteResponse.parse({
      id: note.id,
      ticketId: note.conversationId,
      authorName: note.authorName,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    }),
  );
});

export default router;
