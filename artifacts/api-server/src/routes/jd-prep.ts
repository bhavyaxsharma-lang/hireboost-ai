import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// POST /interview/jd-prep
// Accepts { jobDescription, questionCount } — returns JD analysis + tailored Q&A
router.post("/jd-prep", async (req, res) => {
  const userId = req.session?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { jobDescription, questionCount = 8 } = req.body;

  if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 50) {
    res.status(400).json({ error: "Please provide a job description of at least 50 characters." });
    return;
  }

  const count = Math.min(Math.max(Number(questionCount) || 8, 3), 15);

  try {
    const prompt = `You are a senior career coach and hiring expert. Analyze the following job description and generate ${count} highly relevant interview questions WITH strong model answers tailored specifically to this role.

JOB DESCRIPTION:
"""
${jobDescription.trim()}
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
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";

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
      result = JSON.parse(content) as typeof result;
    } catch {
      res.status(500).json({ error: "AI returned an unexpected response. Please try again." });
      return;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error generating JD prep");
    res.status(500).json({ error: "Failed to generate questions. Please try again." });
  }
});

export default router;
