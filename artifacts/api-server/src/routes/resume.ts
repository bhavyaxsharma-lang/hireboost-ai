// Resume analysis routes
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { db, resumeAnalyses, payments, rewriteLogs } from "@workspace/db";
import {   eq,
  and,
  gte,
  desc,
  count,
  isNull,
  sql, } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { UploadResumeBody, AnalyzeResumeBody, GetResumeAnalysisParams } from "@workspace/api-zod";

const router = Router();

const isMockMode = process.env.MOCK_RESPONSES === "true";

const FREE_REWRITE_LIMIT = 1;
const RewriteResumeBody = z.object({
  resumeText: z.string().min(1),
  atsScore: z.number().optional(),
  missingKeywords: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  overallFeedback: z.string().optional(),
  jobTitle: z.string().optional(),
});
const ResumeAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100),
  missingKeywords: z.array(z.string()),
  suggestions: z.array(z.string()),
  strengths: z.array(z.string()),
  overallFeedback: z.string(),
});

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
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.status, "verified"),
        eq(payments.used, 0)
      )
    )
    .limit(1);

  return payment ?? null;
}
router.get("/rewrite-status", requireAuth, async (req, res) => {
  res.setHeader(
  "Cache-Control",
  "no-store, no-cache, must-revalidate, proxy-revalidate"
);

res.setHeader("Pragma", "no-cache");
res.setHeader("Expires", "0");
  

  try {
    const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

 

    const freeUsed = await getFreeRewriteCount(userId);
    const unusedPayment = await getUnusedPayment(userId);

  return res.json({
  freeUsed,
  freeLimit: FREE_REWRITE_LIMIT,
  hasPaidCredit: !!unusedPayment,
});
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch rewrite status",
    });
  }
});


// POST /resume/analyze — AI analysis (requires authentication)
// GET /resume/history — list past analyses


// GET /resume/daily-usage — returns how many analyses the user has done today
router.get("/daily-usage", requireAuth, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const results = await db
    .select({ id: resumeAnalyses.id })
    .from(resumeAnalyses)
    .where(
      and(
        eq(resumeAnalyses.userId, userId),
        gte(resumeAnalyses.createdAt, todayStart)
      )
    );

  const used = results.length;

  return res.json({
    used,
    limit: FREE_REWRITE_LIMIT,
    isPro: false,
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

// POST /resume/analyze — AI analysis (requires authentication)

router.post("/analyze", requireAuth, async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

  const parseResult = AnalyzeResumeBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { resumeText, jobTitle, jobDescription } = parseResult.data;

const safeResumeText = resumeText.slice(0, 15000);
const safeJobDescription = jobDescription?.slice(0, 10000);

  if (isMockMode) {
    res.json({
      id: 0,
      userId,
      atsScore: 87,
      missingKeywords: ["UiPath", "RPA", "Automation Framework", "Process Design", "Stakeholder Communication"],
      suggestions: [
        "Highlight UiPath and RPA project outcomes with metrics",
        "Quantify process improvements and time savings",
        "Use role-specific keywords from the target job description",
        "Call out leadership and cross-functional collaboration",
        "Showcase client-facing delivery experience"
      ],
      strengths: ["Strong RPA experience", "Leadership exposure", "Client handling"],
      overallFeedback: "Your resume shows strong RPA expertise and leadership potential. Add more metrics and role-specific keywords to improve ATS match.",
      resumeText,
      jobTitle: jobTitle ?? null,
      jobDescription: jobDescription ?? null,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyzer and career coach. 
Analyze the provided resume and return a detailed evaluation as a JSON object.
Return ONLY valid JSON, no markdown, no explanation.`;

  const userPrompt = `Analyze this resume${jobTitle ? ` for the position of ${jobTitle}` : ""}:

${safeResumeText}

${safeJobDescription ? `Job Description:\n${safeJobDescription}\n` : ""}

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
      model: "gpt-4.1",
      max_completion_tokens: 12000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";

const content = rawContent
  .replace(/^```json\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/\s*```$/, "")
  .trim();
    let analysisData: {
      atsScore: number;
      missingKeywords: string[];
      suggestions: string[];
      strengths: string[];
      overallFeedback: string;
    };

  try {
  analysisData = ResumeAnalysisSchema.parse(
    JSON.parse(content)
  );
} catch {
  return res.status(500).json({
    error: "AI returned an invalid response. Please try again.",
  });
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
router.get("/history/", requireAuth, async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
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
router.get("/history/:id", requireAuth, async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}


  const parseResult = GetResumeAnalysisParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [analysis] = await db.select().from(resumeAnalyses).where(and(eq(resumeAnalyses.id, parseResult.data.id), eq(resumeAnalyses.userId, userId))).limit(1);
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

// POST /resume/rewrite — AI rewrite (1 free lifetime, then ₹199 per rewrite)
router.post("/rewrite", requireAuth, async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}


 

 const parseResult = RewriteResumeBody.safeParse(req.body);

if (!parseResult.success) {
  return res.status(400).json({
    error: "Invalid request body",
  });
}

const {
  resumeText,
  atsScore,
  missingKeywords,
  suggestions,
  strengths,
  overallFeedback,
  jobTitle,
} = parseResult.data;



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
          message: "You have used your 1 free resume rewrite. Please pay ₹199 to continue.",
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
          message: "You have used your 1 free resume rewrite. Please pay ₹199 to continue.",
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
        message: "You have used your 1 free resume rewrite. Please pay ₹199 to continue.",
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
        message: "You have used your 1 free resume rewrite. Please pay ₹199 to continue.",
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

Rewrite the resume as a premium ATS-optimized executive resume.

Formatting Requirements:

Create a powerful EXECUTIVE SUMMARY section
Create an EXECUTIVE SUMMARY that:

- Uses quantified achievements
- Highlights leadership
- Highlights GenAI, Agentic AI and Automation
- Includes ATS keywords naturally
- Is written in recruiter-ready language
- No generic statements
For every role:

- Write achievement-oriented bullets
- Start bullets with action verbs
- Include measurable impact wherever possible
- Use STAR/CAR style writing
- Focus on outcomes instead of responsibilities

Write professional bullet points.

For every experience section:

Use achievement-focused bullets.

Prefer:

Action + Metric + Outcome

Examples:

Reduced cycle time by 40%
Delivered $500K annual savings
Automated 20 FTE effort
Improved SLA compliance to 98%
Reduced manual effort by 60%

Do not write generic responsibility bullets.

1. Start with the candidate name in uppercase.

2. Immediately below the name include:
   - Current Target Title
   - Phone
   - Email
   - Location
   - LinkedIn (if available)

3. Create a powerful EXECUTIVE SUMMARY section:
   - 4-6 lines
   - Highlight years of experience
   - Key domains
   - Automation, AI, leadership and business impact

4. Create a CORE COMPETENCIES section:
   - Use bullet points
   - Group skills logically
   - Keep ATS-friendly keywords

5. Create a PROFESSIONAL EXPERIENCE section:
   - Most recent employer first
   - Company Name in uppercase
   - Designation
   - Employment Duration

6. For every company include:

   KEY RESPONSIBILITIES
   - Bullet points

   KEY ACHIEVEMENTS
   - Quantified achievements
   - Savings
   - Productivity gains
   - Compliance improvements

   KEY PROJECTS
   For each major project provide:

   Project Name
   Client / Industry
   Tools Used
   Business Impact

7. Keep bullets concise and achievement-focused.

8. Use strong action verbs.

9. Preserve all factual information from the original resume.

10. End with:

EDUCATION

CERTIFICATIONS

11. Do not use tables.

12. Do not use icons.

13. Do not write explanatory text.

14. Return only the final resume.

IMPORTANT RULES:
Do NOT create a Contact Information section.

Show contact details directly below the candidate name.
- Never output placeholder text such as:
  "(add link)"
  "(if applicable)"
  "(if used)"
  "(verify dates)"
  "(update actual dates)"
  "(add metrics if available)"

- If information is unavailable, omit it completely.

- Return only final resume-ready content.

CRITICAL:

Never generate:

(add link)
(optional link)
(add if used)
(where applicable)
(if available)
(if applicable)

If information is unavailable,
omit the line completely.

Do not add notes, warnings,
recommendations,
disclaimers,
or explanations.

Return resume content only.
`;

try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 12000,
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
