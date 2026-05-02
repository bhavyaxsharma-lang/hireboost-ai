// Resume analysis routes
import { Router } from "express";
import { db, resumeAnalyses, payments, rewriteLogs } from "@workspace/db";
import { eq, desc, gte, and, isNull, count, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { UploadResumeBody, AnalyzeResumeBody, GetResumeAnalysisParams } from "@workspace/api-zod";

const router = Router();

const FREE_REWRITE_LIMIT = 1;

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

// POST /resume/analyze — AI analysis (requires authentication)
router.post("/analyze", async (req, res) => {
  const userId = req.session?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parseResult = AnalyzeResumeBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
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
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const analyses = await db
      .select({
        id: resumeAnalyses.id,
        atsScore: resumeAnalyses.atsScore,
        jobTitle: resumeAnalyses.jobTitle,
        createdAt: resumeAnalyses.createdAt,
      })
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.userId, userId))
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
  const userId = req.session?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

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

    if (analysis.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
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

// POST /resume/rewrite — AI rewrite (1 free lifetime, then ₹99 per rewrite)
router.post("/rewrite", async (req, res) => {
  const userId = req.session?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

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

  // Atomically claim an entitlement before calling OpenAI to prevent TOCTOU race conditions.
  //
  // Free slot: a transaction holds pg_advisory_xact_lock(userId) so concurrent requests
  //   for the same user serialise. Inside that lock we re-count and only insert if still
  //   under the limit. The lock is released automatically when the transaction commits.
  //
  // Paid credit: UPDATE payments SET used=1 WHERE id=? AND used=0 is inherently atomic at
  //   the row level — only one concurrent UPDATE can match the WHERE clause.
  //
  // Both claims happen BEFORE the slow OpenAI call; on failure we revert.

  let claimedLogId: number | null = null;
  let claimedPaymentId: number | null = null;

  // Fast pre-check (no lock) — avoids acquiring the advisory lock for users who have
  // clearly exhausted free quota; not the authoritative check.
  const freeUsedApprox = await getFreeRewriteCount(userId);

  if (freeUsedApprox < FREE_REWRITE_LIMIT) {
    // Serialise free-slot claims for this user with an advisory transaction lock.
    // pg_advisory_xact_lock blocks until it can acquire, ensuring only one concurrent
    // request performs the count-and-insert at a time.
    type FreeClaimResult =
      | { type: "free_claimed"; logId: number }
      | { type: "limit_reached" };

    const freeResult = await db.transaction(async (tx): Promise<FreeClaimResult> => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}::bigint)`);

      const [{ c }] = await tx
        .select({ c: count() })
        .from(rewriteLogs)
        .where(and(eq(rewriteLogs.userId, userId), isNull(rewriteLogs.paymentId)));

      if (Number(c) >= FREE_REWRITE_LIMIT) {
        return { type: "limit_reached" };
      }

      const [row] = await tx
        .insert(rewriteLogs)
        .values({ userId, paymentId: null })
        .returning({ id: rewriteLogs.id });

      return { type: "free_claimed", logId: row.id };
    });

    if (freeResult.type === "free_claimed") {
      claimedLogId = freeResult.logId;
    } else {
      // Free quota exhausted under lock — try a paid credit
      const unusedPayment = await getUnusedPayment(userId);
      if (!unusedPayment) {
        res.status(402).json({
          error: "payment_required",
          message: "You have used your 1 free resume rewrite. Please pay ₹99 to continue.",
          freeUsed: FREE_REWRITE_LIMIT,
          freeLimit: FREE_REWRITE_LIMIT,
        });
        return;
      }
      const updated = await db.execute(sql`
        UPDATE payments SET used = 1
        WHERE id = ${unusedPayment.id} AND used = 0 AND status = 'verified' AND user_id = ${userId}
      `);
      if ((updated.rowCount ?? 0) === 0) {
        res.status(402).json({
          error: "payment_required",
          message: "You have used your 1 free resume rewrite. Please pay ₹99 to continue.",
          freeUsed: FREE_REWRITE_LIMIT,
          freeLimit: FREE_REWRITE_LIMIT,
        });
        return;
      }
      claimedPaymentId = unusedPayment.id;
    }
  } else {
    // Free quota already exhausted — try a paid credit
    const unusedPayment = await getUnusedPayment(userId);
    if (!unusedPayment) {
      res.status(402).json({
        error: "payment_required",
        message: "You have used your 1 free resume rewrite. Please pay ₹99 to continue.",
        freeUsed: freeUsedApprox,
        freeLimit: FREE_REWRITE_LIMIT,
      });
      return;
    }
    // Atomic conditional update — only one concurrent request per payment row wins
    const updated = await db.execute(sql`
      UPDATE payments SET used = 1
      WHERE id = ${unusedPayment.id} AND used = 0 AND status = 'verified' AND user_id = ${userId}
    `);
    if ((updated.rowCount ?? 0) === 0) {
      res.status(402).json({
        error: "payment_required",
        message: "You have used your 1 free resume rewrite. Please pay ₹99 to continue.",
        freeUsed: freeUsedApprox,
        freeLimit: FREE_REWRITE_LIMIT,
      });
      return;
    }
    claimedPaymentId = unusedPayment.id;
  }

  // Truncate all caller-controlled strings before embedding them in the prompt.
  // The /rewrite route does not use a Zod schema, so these bounds are enforced
  // here as a server-side trust-boundary before the OpenAI call.
  const safeResumeText = resumeText.slice(0, 15_000);
  const safeKeywords = (missingKeywords ?? []).slice(0, 20).map((k) => String(k).slice(0, 100));
  const safeSuggestions = (suggestions ?? []).slice(0, 10).map((s) => String(s).slice(0, 300));
  const safeStrengths = (strengths ?? []).slice(0, 10).map((s) => String(s).slice(0, 300));
  const safeOverallFeedback = String(overallFeedback ?? "N/A").slice(0, 1_000);
  const safeJobTitle = String(jobTitle ?? "").slice(0, 200);

  const prompt = `You are an expert resume writer and career coach. Rewrite and significantly improve the following resume.

CURRENT RESUME:
${safeResumeText}

ANALYSIS FINDINGS:
- ATS Score: ${atsScore ?? "N/A"}/100
- Missing Keywords to Add: ${safeKeywords.join(", ")}
- Key Improvements Needed:
${safeSuggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}
- Existing Strengths to Preserve: ${safeStrengths.join(", ")}
- Overall Feedback: ${safeOverallFeedback}
${safeJobTitle ? `- Target Role: ${safeJobTitle}` : ""}

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
      // Revert claimed entitlement on failure
      if (claimedLogId !== null) {
        await db.execute(sql`DELETE FROM rewrite_logs WHERE id = ${claimedLogId}`);
      }
      if (claimedPaymentId !== null) {
        await db.execute(sql`UPDATE payments SET used = 0 WHERE id = ${claimedPaymentId}`);
      }
      res.status(500).json({ error: "AI did not return an improved resume." });
      return;
    }

    // For paid credits: insert the log row now (credit was already marked used above)
    if (claimedPaymentId !== null) {
      await db.insert(rewriteLogs).values({ userId, paymentId: claimedPaymentId });
    }
    // For free slots the log row was already inserted atomically above (claimedLogId)

    res.json({ improvedResume });
  } catch (err) {
    req.log.error({ err }, "Resume rewrite error");
    // Revert claimed entitlement so the user is not charged for a failed request
    if (claimedLogId !== null) {
      await db.execute(sql`DELETE FROM rewrite_logs WHERE id = ${claimedLogId}`).catch(() => {});
    }
    if (claimedPaymentId !== null) {
      await db.execute(sql`UPDATE payments SET used = 0 WHERE id = ${claimedPaymentId}`).catch(() => {});
    }
    res.status(500).json({ error: "Failed to rewrite resume." });
  }
});

export default router;
