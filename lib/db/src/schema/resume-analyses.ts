import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resumeAnalyses = pgTable("resume_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  resumeText: text("resume_text").notNull(),
  jobTitle: text("job_title"),
  jobDescription: text("job_description"),
  atsScore: integer("ats_score").notNull(),
  missingKeywords: text("missing_keywords").notNull(), // JSON array stored as text
  suggestions: text("suggestions").notNull(), // JSON array stored as text
  strengths: text("strengths").notNull(), // JSON array stored as text
  overallFeedback: text("overall_feedback").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertResumeAnalysisSchema = createInsertSchema(resumeAnalyses).omit({
  id: true,
  createdAt: true,
});

export type ResumeAnalysis = typeof resumeAnalyses.$inferSelect;
export type InsertResumeAnalysis = z.infer<typeof insertResumeAnalysisSchema>;
