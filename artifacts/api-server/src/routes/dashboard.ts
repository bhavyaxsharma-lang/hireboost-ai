// Dashboard stats and activity feed routes
import { Router } from "express";
import { db, resumeAnalyses, interviewSessions } from "@workspace/db";
import { eq, desc, count, avg, sql } from "drizzle-orm";

const router = Router();

// GET /dashboard/stats
router.get("/stats", async (req, res) => {
  const userId = req.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Latest resume score
    const latestResumeResult = await db
      .select({ atsScore: resumeAnalyses.atsScore })
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.userId, userId))
      .orderBy(desc(resumeAnalyses.createdAt))
      .limit(1);

    // Total resumes analyzed
    const totalResumesResult = await db
      .select({ count: count() })
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.userId, userId));

    // Total interview sessions
    const totalInterviewsResult = await db
      .select({ count: count() })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId));

    // Average interview rating (completed sessions only)
    const avgRatingResult = await db
      .select({ avg: avg(interviewSessions.averageRating) })
      .from(interviewSessions)
      .where(sql`${interviewSessions.userId} = ${userId} AND ${interviewSessions.status} = 'completed'`);

    // Completed sessions count
    const completedResult = await db
      .select({ count: count() })
      .from(interviewSessions)
      .where(sql`${interviewSessions.userId} = ${userId} AND ${interviewSessions.status} = 'completed'`);

    // Top job roles
    const topRolesResult = await db
      .select({ jobRole: interviewSessions.jobRole })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .orderBy(desc(interviewSessions.createdAt))
      .limit(5);

    const uniqueRoles = [...new Set(topRolesResult.map((r) => r.jobRole))];

    res.json({
      latestResumeScore: latestResumeResult[0]?.atsScore ?? null,
      totalResumesAnalyzed: totalResumesResult[0]?.count ?? 0,
      totalInterviewSessions: totalInterviewsResult[0]?.count ?? 0,
      averageInterviewRating: avgRatingResult[0]?.avg ? Number(avgRatingResult[0].avg) : null,
      completedInterviews: completedResult[0]?.count ?? 0,
      topJobRoles: uniqueRoles,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard stats");
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

// GET /dashboard/recent-activity
router.get("/recent-activity", async (req, res) => {
  const userId = req.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Get recent resume analyses
    const recentResumes = await db
      .select({
        id: resumeAnalyses.id,
        atsScore: resumeAnalyses.atsScore,
        jobTitle: resumeAnalyses.jobTitle,
        createdAt: resumeAnalyses.createdAt,
      })
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.userId, userId))
      .orderBy(desc(resumeAnalyses.createdAt))
      .limit(5);

    // Get recent interview sessions
    const recentInterviews = await db
      .select({
        id: interviewSessions.id,
        jobRole: interviewSessions.jobRole,
        status: interviewSessions.status,
        averageRating: interviewSessions.averageRating,
        createdAt: interviewSessions.createdAt,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .orderBy(desc(interviewSessions.createdAt))
      .limit(5);

    // Combine and sort by date
    const activities = [
      ...recentResumes.map((r) => ({
        id: `resume-${r.id}`,
        type: "resume_analysis" as const,
        title: "Resume Analyzed",
        subtitle: r.jobTitle ? `For ${r.jobTitle}` : "General analysis",
        score: r.atsScore,
        rating: null,
        createdAt: r.createdAt,
      })),
      ...recentInterviews.map((i) => ({
        id: `interview-${i.id}`,
        type: (i.status === "completed" ? "interview_completed" : "interview_session") as "interview_completed" | "interview_session",
        title: i.status === "completed" ? "Interview Completed" : "Interview Started",
        subtitle: i.jobRole,
        score: null,
        rating: i.averageRating,
        createdAt: i.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    res.json(activities);
  } catch (err) {
    req.log.error({ err }, "Error getting recent activity");
    res.status(500).json({ error: "Failed to get recent activity" });
  }
});

export default router;
