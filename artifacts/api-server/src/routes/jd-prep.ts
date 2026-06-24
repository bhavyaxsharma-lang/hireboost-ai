import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();
const isMockMode = process.env.MOCK_RESPONSES === "true";

// POST /interview/jd-prep
// Accepts { jobDescription, questionCount } — returns JD analysis + tailored Q&A
router.post("/jd-prep", requireAuth, async (req, res) => {
const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

  const { jobDescription, questionCount = 8 } = req.body;

  if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 50) {
    res.status(400).json({ error: "Please provide a job description of at least 50 characters." });
    return;
  }

  // Hard-cap the JD to prevent near-limit prompt payloads from inflating token usage.
  const safeJobDescription = jobDescription.trim().slice(0, 10_000);

  const count = Math.min(Math.max(Number(questionCount) || 8, 3), 15);

  try {
    if (isMockMode) {
      res.json({
        analysis: {
          roleTitle: "RPA Developer",
          seniority: "Mid-level",
          keySkills: ["UiPath", "RPA", "Dispatcher", "Queue Management", "Process Automation"],
          industry: "Information Technology",
          summary: "The employer is looking for a skilled RPA developer who can design and maintain UiPath automations with strong process discipline and queue-based orchestration. The role requires hands-on delivery experience along with the ability to translate business needs into reliable automation solutions.",
        },
        questions: [
          {
            question: "What is Dispatcher?",
            category: "Technical",
            whyAsked: "To evaluate your understanding of UiPath queue-based automation architecture.",
            modelAnswer: "Dispatcher pushes transactions into a UiPath Orchestrator queue by reading input data and creating queue items for the Performer to consume. It is the producer in a dispatcher-performer pattern, ensuring work is staged reliably and can be retried or audited. A strong answer explains how Dispatcher separates data ingestion from execution and helps scale automation across multiple processes.",
            tips: [
              "Explain Dispatcher as the producer role in the Dispatcher-Performer pattern.",
              "Mention that Dispatcher creates queue items for the Performer to process later.",
            ],
          },
        ],
      });
      return;
    }

    const prompt = `You are a senior career coach and hiring expert. Analyze the following job description and generate ${count} highly relevant interview questions WITH strong model answers tailored specifically to this role.

JOB DESCRIPTION:
"""
${safeJobDescription}
"""

Return ONLY valid JSON in this exact structure:
{
  "analysis": {
    "roleTitle": "<inferred job title>",
    "seniority": "<Junior | Mid-level | Senior | Lead | Executive>",
    "keySkills": ["<skill1>", "<skill2>", "<skill3>", "<skill4>", "<skill5>"],
    "industry": "<industry sector>",
    "summary": "<2-sentence summary of what the employer is looking for>"
  },
  "questions": [
    {
      "question": "<interview question tailored to the JD>",
      "category": "<Technical | Behavioral | Situational | Role-Specific | Culture Fit>",
      "whyAsked": "<1 sentence: why this question is relevant to this specific JD>",
      "modelAnswer": "<A strong, specific model answer using STAR method where applicable. 4-6 sentences. Reference skills/requirements from the JD.>",
      "tips": ["<tip1>", "<tip2>"]
    }
  ]
}

Mix categories: include Technical, Behavioral, Role-Specific, and Situational questions. Make questions and answers highly specific to the actual JD content — not generic.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";

const content = rawContent
  .replace(/^```json\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/\s*```$/, "")
  .trim();

    let result: {
      analysis: {
        roleTitle: string;
        seniority: string;
        keySkills: string[];
        industry: string;
        summary: string;
      };
      questions: Array<{
        question: string;
        category: string;
        whyAsked: string;
        modelAnswer: string;
        tips: string[];
      }>;
    };

  try {
  result = JSON.parse(content);

  if (
    !result ||
    typeof result !== "object" ||
    !result.analysis ||
    !Array.isArray(result.questions)
  ) {
    throw new Error("Invalid AI response structure");
  }
} catch {
  return res.status(500).json({
    error: "AI returned an unexpected response. Please try again.",
  });
}

    res.json(result);
  } catch (err: any) {
    console.error("JD PREP ERROR");
    console.error(err);

    res.status(500).json({
      error: String(err?.message || err)
    });
  }
});

export default router;
