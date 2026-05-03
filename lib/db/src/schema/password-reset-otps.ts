import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const passwordResetOtps = pgTable("password_reset_otps", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PasswordResetOtp = typeof passwordResetOtps.$inferSelect;
