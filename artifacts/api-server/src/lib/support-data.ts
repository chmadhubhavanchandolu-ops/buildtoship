import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversationMessagesTable,
  conversationsTable,
  internalNotesTable,
  supportUsersTable,
  type ConversationRecord,
} from "@workspace/db";

function iso(date: Date): string {
  return date.toISOString();
}

export async function mapConversationSummaries(records: ConversationRecord[]) {
  if (records.length === 0) return [];

  const [users, latestMessages] = await Promise.all([
    db.select().from(supportUsersTable),
    db
      .select()
      .from(conversationMessagesTable)
      .where(
        inArray(
          conversationMessagesTable.conversationId,
          records.map((record) => record.id),
        ),
      )
      .orderBy(desc(conversationMessagesTable.createdAt)),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));
  const messageByConversation = new Map<
    string,
    (typeof latestMessages)[number]
  >();
  for (const message of latestMessages) {
    if (!messageByConversation.has(message.conversationId)) {
      messageByConversation.set(message.conversationId, message);
    }
  }

  return records.map((record) => {
    const customer = userById.get(record.customerId);
    const agent = record.assignedAgentId
      ? userById.get(record.assignedAgentId)
      : null;
    const lastMessage = messageByConversation.get(record.id);
    return {
      id: record.id,
      customerId: record.customerId,
      customerName: customer?.name ?? "Customer",
      customerEmail: customer?.email ?? "",
      assignedAgentId: record.assignedAgentId,
      assignedAgentName: agent?.name ?? null,
      status: record.status,
      priority: record.priority,
      aiConfidence: record.aiConfidence,
      escalationReason: record.escalationReason,
      intent: record.intent,
      summary: record.summary,
      recommendedNextAction: record.recommendedNextAction,
      lastMessage: lastMessage?.content ?? null,
      unreadCount: 0,
      createdAt: iso(record.createdAt),
      updatedAt: iso(record.updatedAt),
    };
  });
}

export async function getConversationRecord(
  id: string,
): Promise<ConversationRecord | null> {
  const [record] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id))
    .limit(1);
  return record ?? null;
}

export async function getConversationDetail(id: string) {
  const record = await getConversationRecord(id);
  if (!record) return null;

  const [summary] = await mapConversationSummaries([record]);
  const [messages, notes] = await Promise.all([
    db
      .select()
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, id))
      .orderBy(conversationMessagesTable.createdAt),
    db
      .select()
      .from(internalNotesTable)
      .where(eq(internalNotesTable.conversationId, id))
      .orderBy(internalNotesTable.createdAt),
  ]);

  return {
    ...summary,
    messages: messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderName: message.senderName,
      content: message.content,
      createdAt: iso(message.createdAt),
      confidence: message.confidence,
      helpful: message.helpful,
    })),
    internalNotes: notes.map((note) => ({
      id: note.id,
      ticketId: note.conversationId,
      authorName: note.authorName,
      content: note.content,
      createdAt: iso(note.createdAt),
    })),
  };
}

export async function listConversationRecords() {
  return db
    .select()
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.updatedAt));
}

export async function customerForConversation(customerId: string) {
  const [customer] = await db
    .select()
    .from(supportUsersTable)
    .where(eq(supportUsersTable.id, customerId))
    .limit(1);
  return customer ?? null;
}

