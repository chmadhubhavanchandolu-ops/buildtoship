import { boolean, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { supportUsersTable } from "./users";

export const conversationsTable = pgTable("support_conversations", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => supportUsersTable.id),
  assignedAgentId: text("assigned_agent_id").references(() => supportUsersTable.id),
  status: text("status", {
    enum: ["ai_handling", "waiting_for_agent", "assigned", "in_progress", "resolved"],
  }).notNull().default("ai_handling"),
  priority: text("priority", { enum: ["low", "medium", "high", "critical"] })
    .notNull()
    .default("low"),
  aiConfidence: real("ai_confidence"),
  escalationReason: text("escalation_reason"),
  intent: text("intent"),
  summary: text("summary"),
  recommendedNextAction: text("recommended_next_action"),
  ticketNumber: text("ticket_number").unique(),
  aiResolved: boolean("ai_resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const conversationMessagesTable = pgTable("support_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderType: text("sender_type", { enum: ["customer", "ai", "agent", "system"] }).notNull(),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  confidence: real("confidence"),
  helpful: boolean("helpful"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConversationRecord = typeof conversationsTable.$inferSelect;
export type ConversationMessage = typeof conversationMessagesTable.$inferSelect;
