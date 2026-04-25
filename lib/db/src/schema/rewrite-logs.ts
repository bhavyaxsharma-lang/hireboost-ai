import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const rewriteLogs = pgTable("rewrite_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  paymentId: integer("payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RewriteLog = typeof rewriteLogs.$inferSelect;
