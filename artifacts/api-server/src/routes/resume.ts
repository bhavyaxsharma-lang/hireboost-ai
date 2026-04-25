// Resume analysis routes
import { Router } from "express";
import { db, resumeAnalyses, payments, rewriteLogs } from "@workspace/db";
import { eq, desc, gte, and, isNull, count } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { UploadResumeBody, AnalyzeResumeBody, GetResumeAnalysisParams } from "@workspace/api-zod";

const router = Router();

const FREE_REWRITE_LIMIT = 2;

// Helper: count total free rewrites used by a user (lifetime)
async function getFreeRewriteCount(userId: number): Promise<number> {
  const [result] = await db
    .select({ c: count() })
    .from(rewriteLogs)
    .where(and(eq(rewriteLogs.userId, userId), isNull(rewriteLogs.paymentId)));
  return Number(result?.c ?? 0);
}

// Helper: find an unused verified payment for a user
async function getUnusedPayment(userId: number) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "verified"), eq(payments.used, 0)))
    .limit(1);
  return payment ?? null;
}

// GET /resume/rewrite-status — returns free rewrite usage and credit availability
router.get("/rewrite-status", async (req, res) => {
  const userId = req.session?.userId ?? null;
  if (!userId) {
    res.json({ freeUsed: 0, freeLimit: FREE_REWRITE_LIMIT, hasPaidCredit: false });
    return;
  }
  const freeUsed = await getFreeRewriteCount(userId);
  const hasPaidCredit = !!(await getUnusedPayment(userId));
  res.json({ freeUsed, freeLimit: FREE_REWRITE_LIMIT, hasPaidCredit });
});

// GET /resume/daily-usage — returns how many analyses the user has done today
router.get("/daily-usage", async (req, res) => {
  const userId = req.session?.userId ?? null;

  let used = 0;
  if (userId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const results = await db
      .select({ id: resumeAnalyses.id })
      .from(resumeAnalyses)
      .where(and(eq(resumeAnalyses.userId, userId), gte(resumeAnalyses.createdAt, todayStart)));
    used = results.length;
  }

  res.json({ used, limit: FREE_REWRITE_LIMIT, isPro: false });
});

// POST /resume/upload — extract and return resume text + word count
router.post("/upload", async (req, res) => {
  const parseResult = UploadResumeBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { resumeText } = parseResult.data;
  const wordCount = resumeText.trim().split(/\s+/).length;

  res.json({
    extractedText: resumeText,
    wordCount,
  });
});

// POST /resume/analyze — AI analysis (unlimited, no rate limiting)
router.post("/analyze", async (req, res) => {
  const parseResult = AnalyzeResumeBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const userId = req.session?.userId ?? null;
  const { resumeText, jobTitle, jobDescription } = parseResult.data;

  const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyzer and career coach. 
Analyze the provided resume and return a detailed evaluation as a JSON object.
Return ONLY valid JSON, no markdown, no explanation.`;

  const userPrompt = `Analyze this resume${jobTitle ? ` for the position of ${jobTitle}` : ""}:

${resumeText}

${jobDescription ? `Job Description:\n${jobDescription}\n` : ""}

Return a JSON object with exactly these fields:
{
  "atsScore": <number 0-100>,
  "missingKeywords": [<array of 5-10 important missing keywords/skills>],
  "suggestions": [<array of 5-8 specific improvement suggestions>],
  "strengths": [<array of 3-5 resume strengths>],
  "overallFeedback": "<2-3 sentence overall assessment>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let analysisData: {
      atsScore: number;
      missingKeywords: string[];
      suggestions: string[];
      strengths: string[];
      overallFeedback: string;
    };

    try {
      analysisData = JSON.parse(content);
    } catch {
      analysisData = {
        atsScore: 50,
        missingKeywords: ["Could not parse AI response"],
        suggestions: ["Please try again"],
        strengths: ["Resume received"],
        overallFeedback: "Analysis encountered an error. Please try again.",
      };
    }

    // Save analysis to database
    const [saved] = await db.insert(resumeAnalyses).values({
      userId,
      resumeText,
      jobTitle: jobTitle ?? null,
      jobDescription: jobDescription ?? null,
      atsScore: analysisData.atsScore,
      missingKeywords: JSON.stringify(analysisData.missingKeywords),
      suggestions: JSON.stringify(analysisData.suggestions),
      strengths: JSON.stringify(analysisData.strengths),
      overallFeedback: analysisData.overallFeedback,
    }).returning();

    res.json({
      id: saved.id,
      userId: saved.userId,
      atsScore: saved.atsScore,
      missingKeywords: analysisData.missingKeywords,
      suggestions: analysisData.suggestions,
      strengths: analysisData.strengths,
      overallFeedback: saved.overallFeedback,
      resumeText: saved.resumeText,
      jobTitle: saved.jobTitle,
      createdAt: saved.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error analyzing resume");
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

// GET /resume/history — list past analyses
router.get("/history", async (req, res) => {
  const userId = req.session?.userId ?? null;

  try {
    const analyses = await db
      .select({
        id: resumeAnalyses.id,
        atsScore: resumeAnalyses.atsScore,
        jobTitle: resumeAnalyses.jobTitle,
        createdAt: resumeAnalyses.createdAt,
      })
      .from(resumeAnalyses)
      .where(userId ? eq(resumeAnalyses.userId, userId) : undefined)
      .orderBy(desc(resumeAnalyses.createdAt))
      .limit(20);

    res.json(analyses);
  } catch (err) {
    req.log.error({ err }, "Error getting resume history");
    res.status(500).json({ error: "Failed to get resume history" });
  }
});

// GET /resume/history/:id — get specific analysis
router.get("/history/:id", async (req, res) => {
  const parseResult = GetResumeAnalysisParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [analysis] = await db.select().from(resumeAnalyses).where(eq(resumeAnalyses.id, parseResult.data.id)).limit(1);
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    res.json({
      id: analysis.id,
      userId: analysis.userId,
      atsScore: analysis.atsScore,
      missingKeywords: JSON.parse(analysis.missingKeywords) as string[],
      suggestions: JSON.parse(analysis.suggestions) as string[],
      strengths: JSON.parse(analysis.strengths) as string[],
      overallFeedback: analysis.overallFeedback,
      resumeText: analysis.resumeText,
      jobTitle: analysis.jobTitle,
      createdAt: analysis.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting resume analysis");
    res.status(500).json({ error: "Failed to get analysis" });
  }
});

// POST /resume/rewrite — AI rewrite (2 free lifetime, then ₹100 per rewrite)
router.post("/rewrite", async (req, res) => {
  const userId = req.session?.userId ?? null;
  const { resumeText, atsScore, missingKeywords, suggestions, strengths, overallFeedback, jobTitle } =
    req.body as {
      resumeText?: string;
      atsScore?: number;
      missingKeywords?: string[];
      suggestions?: string[];
      strengths?: string[];
      overallFeedback?: string;
      jobTitle?: string;
    };

  if (!resumeText) {
    res.status(400).json({ error: "Missing resumeText." });
    return;
  }

  // Credit check (only for authenticated users)
  let paymentUsed: typeof payments.$inferSelect | null = null;
  if (userId) {
    const freeUsed = await getFreeRewriteCount(userId);
    if (freeUsed >= FREE_REWRITE_LIMIT) {
      // Check for a paid credit
      const unusedPayment = await getUnusedPayment(userId);
      if (!unusedPayment) {
        res.status(402).json({
          error: "payment_required",
          message: "You have used your 2 free resume rewrites. Please pay ₹100 to continue.",
          freeUsed,
          freeLimit: FREE_REWRITE_LIMIT,
        });
        return;
      }
      paymentUsed = unusedPayment;
    }
  }

  const prompt = `You are an expert resume writer and career coach. Rewrite and significantly improve the following resume.

CURRENT RESUME:
${resumeText}

ANALYSIS FINDINGS:
- ATS Score: ${atsScore ?? "N/A"}/100
- Missing Keywords to Add: ${(missingKeywords ?? []).join(", ")}
- Key Improvements Needed:
${(suggestions ?? []).map((s, i) => `${i + 1}. ${s}`).join("\n")}
- Existing Strengths to Preserve: ${(strengths ?? []).join(", ")}
- Overall Feedback: ${overallFeedback ?? "N/A"}
${jobTitle ? `- Target Role: ${jobTitle}` : ""}

INSTRUCTIONS:
1. Rewrite the entire resume addressing ALL missing keywords and suggestions.
2. Preserve the person's actual experience, education, and achievements — do not invent new ones.
3. Use strong action verbs, quantify achievements where possible, ATS-friendly format.
4. Structure clearly: Summary, Experience, Skills, Education (and other relevant sections).
5. Return ONLY the improved resume text — no commentary, no headers like "Improved Resume:".`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: "You are an expert resume writer. Rewrite resumes to be ATS-optimized and compelling." },
        { role: "user", content: prompt },
      ],
    });

    const improvedResume = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!improvedResume) {
      res.status(500).json({ error: "AI did not return an improved resume." });
      return;
    }

    // Log rewrite usage
    if (userId) {
      await db.insert(rewriteLogs).values({
        userId,
        paymentId: paymentUsed?.id ?? null,
      });
      // Consume the paid credit if one was used
      if (paymentUsed) {
        await db.update(payments).set({ used: 1 }).where(eq(payments.id, paymentUsed.id));
      }
    }

    res.json({ improvedResume });
  } catch (err) {
    req.log.error({ err }, "Resume rewrite error");
    res.status(500).json({ error: "Failed to rewrite resume." });
  }
});

export default router;
