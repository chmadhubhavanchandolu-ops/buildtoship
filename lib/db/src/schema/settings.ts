import { pgTable, real, integer } from "drizzle-orm/pg-core";

export const supportSettingsTable = pgTable("support_settings", {
  id: integer("id").primaryKey().default(1),
  confidenceThreshold: real("confidence_threshold").notNull().default(0.72),
});
