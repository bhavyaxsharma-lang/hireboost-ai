// Resume analysis routes
import { Router } from "express";
import { db, resumeAnalyses } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { UploadResumeBody, AnalyzeResumeBody, GetResumeAnalysisParams } from "@workspace/api-zod";

const router = Router();

const FREE_DAILY_LIMIT = 2;

// Helper: count how many analyses a user has done today
async function getDailyUsageCount(userId: number | null): Promise<number> {
  if (!userId) return 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const results = await db
    .select({ id: resumeAnalyses.id })
    .from(resumeAnalyses)
    .where(and(eq(resumeAnalyses.userId, userId), gte(resumeAnalyses.createdAt, todayStart)));

  return results.length;
}

// GET /resume/daily-usage — returns how many scans the user has done today
router.get("/daily-usage", async (req, res) => {
  const userId = req.session?.userId ?? null;
  const used = await getDailyUsageCount(userId);

  res.json({
    used,
    limit: FREE_DAILY_LIMIT,
    isPro: false, // All users are free tier for now
  });
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

// POST /resume/analyze — AI analysis with daily limit enforcement
router.post("/analyze", async (req, res) => {
  const parseResult = AnalyzeResumeBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const userId = req.session?.userId ?? null;

  // Enforce daily limit for logged-in free users
  if (userId) {
    const usedToday = await getDailyUsageCount(userId);
    if (usedToday >= FREE_DAILY_LIMIT) {
      res.status(429).json({
        error: "Daily limit reached",
        used: usedToday,
        limit: FREE_DAILY_LIMIT,
      });
      return;
    }
  }

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

// POST /resume/rewrite — free AI rewrite using analysis results
router.post("/rewrite", async (req, res) => {
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
    res.json({ improvedResume });
  } catch (err) {
    req.log.error({ err }, "Resume rewrite error");
    res.status(500).json({ error: "Failed to rewrite resume." });
  }
});

export default router;
