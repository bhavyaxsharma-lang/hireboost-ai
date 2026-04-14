import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewSessions = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  jobRole: text("job_role").notNull(),
  difficulty: text("difficulty").notNull().default("medium"),
  status: text("status").notNull().default("in_progress"), // in_progress | completed
  averageRating: real("average_rating"),
  totalQuestions: integer("total_questions").notNull().default(0),
  answeredQuestions: integer("answered_questions").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const interviewQuestions = pgTable("interview_questions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  questionText: text("question_text").notNull(),
  questionIndex: integer("question_index").notNull(),
  userAnswer: text("user_answer"),
  aiFeedback: text("ai_feedback"),
  sampleAnswer: text("sample_answer"),
  rating: integer("rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertInterviewSessionSchema = createInsertSchema(interviewSessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertInterviewQuestionSchema = createInsertSchema(interviewQuestions).omit({
  id: true,
  createdAt: true,
});

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type InsertInterviewSession = z.infer<typeof insertInterviewSessionSchema>;
export type InterviewQuestion = typeof interviewQuestions.$inferSelect;
export type InsertInterviewQuestion = z.infer<typeof insertInterviewQuestionSchema>;
