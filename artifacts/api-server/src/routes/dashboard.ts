// Dashboard stats and activity feed routes
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db, resumeAnalyses, interviewSessions } from "@workspace/db";
import { eq, desc, count, avg, sql } from "drizzle-orm";

const router = Router();
const isMockMode = process.env.MOCK_RESPONSES === "true";
const isProduction = process.env.NODE_ENV === "production";

// GET /dashboard/stats
router.get("/stats", requireAuth, async (req, res) => {
const userId = req.userId;

if (!userId) {
  res.status(401).json({
    error: "Authentication required",
  });
  return;
}

  try {
    // Mock mode: return sample stats
    if (isMockMode) {
      res.json({
        latestResumeScore: 78,
        totalResumesAnalyzed: 3,
        totalInterviewSessions: 2,
        averageInterviewRating: 4.2,
        completedInterviews: 1,
        topJobRoles: ["Software Engineer", "Product Manager"],
      });
      return;
    }

    

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

    const uniqueRoles = [
      ...new Set(
        topRolesResult
          .map((r: { jobRole: string | null }) => r.jobRole)
          .filter((role: string | null): role is string => Boolean(role))
      ),
    ];

    res.json({
      latestResumeScore: latestResumeResult[0]?.atsScore ?? null,
      totalResumesAnalyzed: totalResumesResult[0]?.count ?? 0,
      totalInterviewSessions: totalInterviewsResult[0]?.count ?? 0,
      averageInterviewRating:
  avgRatingResult[0]?.avg != null
    ? Number(avgRatingResult[0].avg)
    : null,
      completedInterviews: completedResult[0]?.count ?? 0,
      topJobRoles: uniqueRoles,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting dashboard stats");
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

// GET /dashboard/recent-activity
router.get("/recent-activity", requireAuth, async (req, res) => {
const userId = req.userId;

if (!userId) {
  res.status(401).json({
    error: "Authentication required",
  });
  return;
}

  try {
    // Mock mode: return sample activity
    if (isMockMode) {
      const now = new Date();
      res.json([
        {
          id: "resume-1",
          type: "resume_analysis",
          title: "Resume Analyzed",
          subtitle: "For Software Engineer",
          score: 78,
          rating: null,
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "interview-1",
          type: "interview_completed",
          title: "Interview Completed",
          subtitle: "Senior React Developer",
          score: null,
          rating: 4.5,
          createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "resume-2",
          type: "resume_analysis",
          title: "Resume Analyzed",
          subtitle: "For Product Manager",
          score: 82,
          rating: null,
          createdAt: now.toISOString(),
        },
      ]);
      return;
    }

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
      ...recentResumes.map((r: { id: number; atsScore: number | null; jobTitle: string | null; createdAt: Date | string }) => ({
        id: `resume-${r.id}`,
        type: "resume_analysis" as const,
        title: "Resume Analyzed",
        subtitle: r.jobTitle ? `For ${r.jobTitle}` : "General analysis",
        score: r.atsScore,
        rating: null,
        createdAt: r.createdAt,
      })),
      ...recentInterviews.map((i: { id: number; jobRole: string | null; status: string; averageRating: number | null; createdAt: Date | string }) => ({
        id: `interview-${i.id}`,
        type: (i.status === "completed" ? "interview_completed" : "interview_session") as "interview_completed" | "interview_session",
        title: i.status === "completed" ? "Interview Completed" : "Interview Started",
        subtitle: i.jobRole,
        score: null,
        rating: i.averageRating,
        createdAt: i.createdAt,
      })),
    ].sort((a: { createdAt?: Date | string | null }, b: { createdAt?: Date | string | null }) => {
  const aTime = a.createdAt
    ? new Date(a.createdAt).getTime()
    : 0;

  const bTime = b.createdAt
    ? new Date(b.createdAt).getTime()
    : 0;

  return bTime - aTime;
})
      .slice(0, 10);

    res.json(activities);
  } catch (err) {
    req.log.error({ err }, "Error getting recent activity");
    res.status(500).json({ error: "Failed to get recent activity" });
  }
});

export default router;
