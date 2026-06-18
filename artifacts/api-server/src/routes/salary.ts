import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
const isMockMode = process.env.MOCK_RESPONSES === "true";

// POST /salary/generate
router.post("/generate", requireAuth, async (req, res) => {
  const body = req.body as {
    currentSalary?: unknown;
    offeredSalary?: unknown;
    targetSalary?: unknown;
    role?: unknown;
    experience?: unknown;
    location?: unknown;
    skills?: unknown;
  };

  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

if (typeof body.role !== "string" || body.role.trim().length < 2) {
    res.status(400).json({ error: "role is required" });
    return;
  }
  if (typeof body.experience !== "number" || body.experience < 0) {
    res.status(400).json({ error: "experience must be a non-negative number" });
    return;
  }
  if (typeof body.currentSalary !== "number" || body.currentSalary <= 0) {
    res.status(400).json({ error: "currentSalary must be a positive number" });
    return;
  }
  if (typeof body.offeredSalary !== "number" || body.offeredSalary <= 0) {
    res.status(400).json({ error: "offeredSalary must be a positive number" });
    return;
  }

  const role = body.role.trim().slice(0, 200);
  const experience = body.experience;
  const currentSalary = body.currentSalary;
  const offeredSalary = body.offeredSalary;
  const targetSalary = typeof body.targetSalary === "number" && body.targetSalary > 0
    ? body.targetSalary
    : Math.round(offeredSalary * 1.15);
  const location = typeof body.location === "string" ? body.location.trim().slice(0, 100) : "India";
  const skills = typeof body.skills === "string" ? body.skills.trim().slice(0, 300) : "";

  if (isMockMode) {
    res.json({
      counterOfferScript: "Based on my 14 years of RPA experience, I would request a CTC closer to ₹27 LPA to reflect the value I deliver in automation and process transformation. I appreciate the offer and remain enthusiastic about this role, and I believe this figure is aligned with current market benchmarks for senior UiPath practitioners.",
      hrMessage: "Subject: Compensation Discussion — RPA Role\n\nDear Hiring Team,\n\nThank you for offering me the RPA position. I am very excited about the opportunity and the chance to contribute to your automation initiatives. Based on my 14 years of UiPath and RPA experience, I would like to discuss a package closer to ₹27 LPA, which better reflects the market and the specialised skills I bring. I hope we can find a mutually agreeable number so I can join with confidence and commitment.\n\nWarm regards,\n[Your Name]",
      marketInsight: "A senior RPA professional in India with 14 years of experience typically commands 25-30 LPA, especially for UiPath automation roles. Your leverage is strong due to deep domain expertise and process automation leadership.",
      suggestedCounter: 2700000,
      negotiationTips: [
        "Lead with gratitude for the offer and then frame the counter around your impact.",
        "Use market benchmarks from UiPath/RPA roles to justify the ask.",
        "Keep the conversation collaborative and ask about total compensation flexibility.",
      ],
      recommendedCTC: "27 LPA",
      negotiationScript: "Based on my 14 years of RPA experience, I would request a CTC closer to ₹27 LPA to reflect the value I deliver in automation and process transformation.",
    });
    return;
  }

  try {
    const prompt = `You are an expert salary negotiation coach helping job seekers in India negotiate better compensation packages.

Scenario:
- Role: ${role}
- Years of Experience: ${experience}
- Current CTC: ₹${currentSalary.toLocaleString()} per annum
- Offered CTC: ₹${offeredSalary.toLocaleString()} per annum
- Target CTC: ₹${targetSalary.toLocaleString()} per annum
- Location: ${location}${skills ? `\n- Key Skills: ${skills}` : ""}

Generate comprehensive salary negotiation material. Return ONLY valid JSON:
{
  "counterOfferScript": "<A confident, natural verbal script to use on a call or in-person. 120-150 words. Acknowledge the offer warmly, state the counter clearly with justification, keep the door open. Use specific numbers only.>",
  "hrMessage": "<Professional email to HR ready to copy-paste. Include a subject line on the very first line starting with 'Subject:'. Then blank line, then 150-200 word email body. Formal greeting, gratitude for offer, counter with justification, professional close.>",
  "marketInsight": "<2-3 sentences on typical market CTC for this role+experience in ${location}. Mention what skills command premium. End with negotiation power rated as Strong, Moderate, or Limited with a brief one-line reason.>",
  "suggestedCounter": <integer — the ideal counter offer in rupees, slightly above target to leave negotiation room>,
  "negotiationTips": ["<specific actionable tip 1>", "<specific actionable tip 2>", "<specific actionable tip 3>"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";

    let result: {
      counterOfferScript: string;
      hrMessage: string;
      marketInsight: string;
      suggestedCounter: number;
      negotiationTips: string[];
    };

   try {
  const parsed = JSON.parse(content);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof parsed.counterOfferScript !== "string" ||
    typeof parsed.hrMessage !== "string" ||
    typeof parsed.marketInsight !== "string" ||
    typeof parsed.suggestedCounter !== "number" ||
    !Array.isArray(parsed.negotiationTips)
  ) {
    throw new Error("Invalid AI response");
  }

  result = parsed;
} catch {
      const suggestedCounter = Math.round(targetSalary * 1.05);
      result = {
        counterOfferScript: `Thank you so much for the offer — I'm genuinely excited about this opportunity. I've done thorough market research for the ${role} role in ${location}, and based on my ${experience} years of experience, I was expecting compensation closer to ₹${targetSalary.toLocaleString()} per annum. Is there any flexibility to move towards that number? I'm very motivated to make this work.`,
        hrMessage: `Subject: Regarding Compensation Package — ${role} Position\n\nDear Hiring Team,\n\nThank you for extending the offer for the ${role} position. I'm genuinely excited about this opportunity.\n\nAfter careful market research, I'd like to respectfully discuss the compensation. Given my ${experience} years of experience and current benchmarks in ${location}, I was hoping we could explore a package of ₹${targetSalary.toLocaleString()} per annum.\n\nI remain very enthusiastic and hope we can find a mutually agreeable arrangement.\n\nWarm regards`,
        marketInsight: `For a ${role} with ${experience} years of experience in ${location}, market CTC typically ranges from ₹${Math.round(offeredSalary * 0.9).toLocaleString()} to ₹${Math.round(offeredSalary * 1.35).toLocaleString()} per annum. Specialised skills and domain expertise can command a 10–20% premium. Negotiation Power: Moderate — you have reasonable leverage with your experience level.`,
        suggestedCounter,
        negotiationTips: [
          "Always counter in writing via email — it creates a paper trail and gives HR time to consult management",
          "Ask about the full package: joining bonus, performance review cycle, WFH allowance, and ESOPs",
          "Never accept on the spot — say 'I'd like 24 hours to consider' and use that time to prepare your counter",
        ],
      };
    }

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error generating salary negotiation");
    return res.status(500).json({
  error: "Failed to generate negotiation scripts",
});
  }
});

export default router;
