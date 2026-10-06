import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const supportUsersTable = pgTable("support_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["customer", "agent", "admin"] }).notNull(),
  avatar: text("avatar").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SupportUser = typeof supportUsersTable.$inferSelect;
