import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  amountPaise: integer("amount_paise").notNull(),
  status: text("status").notNull().default("pending"),
  used: integer("used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
