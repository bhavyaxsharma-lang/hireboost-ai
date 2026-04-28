import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

type Tone = "professional" | "storytelling" | "motivational";
const VALID_TONES: Tone[] = ["professional", "storytelling", "motivational"];

// POST /linkedin/generate
router.post("/generate", requireAuth, async (req, res) => {
  const { topic, tone } = req.body as { topic?: unknown; tone?: unknown };

  if (typeof topic !== "string" || topic.trim().length < 3) {
    res.status(400).json({ error: "topic must be a string of at least 3 characters" });
    return;
  }
  if (!VALID_TONES.includes(tone as Tone)) {
    res.status(400).json({ error: "tone must be professional, storytelling, or motivational" });
    return;
  }

  const safeTopic = topic.trim().slice(0, 500);
  const safeTone = tone as Tone;

  const toneGuide: Record<Tone, string> = {
    professional: "authoritative, data-driven, formal insights",
    storytelling: "personal narrative, vulnerability, real experience",
    motivational: "inspiring, energetic, call-to-action focused",
  };

  try {
    const prompt = `You are a LinkedIn content expert who writes viral posts. Generate a ${safeTone} LinkedIn post about: "${safeTopic}".
Tone style: ${toneGuide[safeTone]}

Return ONLY valid JSON with exactly these fields:
{
  "hook": "<A powerful scroll-stopping first line — max 15 words, no emoji at start, creates curiosity or shock>",
  "post": "<Full LinkedIn post, 180-250 words, ${safeTone} tone. Use very short paragraphs (1-2 sentences each) separated by blank lines for mobile readability. Include 2-3 emojis naturally placed. End with an engaging question or CTA.>",
  "hashtags": ["<hashtag1>", "<hashtag2>", "<hashtag3>", "<hashtag4>", "<hashtag5>"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let result: { hook: string; post: string; hashtags: string[] };

    try {
      result = JSON.parse(content) as typeof result;
    } catch {
      result = {
        hook: `Here's what nobody tells you about ${safeTopic}`,
        post: `I've been thinking a lot about ${safeTopic} lately.\n\nHere's the uncomfortable truth most people ignore.\n\nThose who adapt early will thrive. Those who don't will scramble to catch up. 📊\n\nI've seen this pattern repeat across industries — and the gap is widening every year.\n\nThe question isn't whether you should pay attention to this. The question is: what are you doing about it today?\n\nStart small. Stay consistent. Build forward. 💡\n\nWhat's been your biggest challenge with this? Drop it in the comments — I read every reply.`,
        hashtags: ["#LinkedIn", "#CareerGrowth", "#ProfessionalDevelopment", "#Success", "#Learning"],
      };
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error generating LinkedIn post");
    res.status(500).json({ error: "Failed to generate post" });
  }
});

// POST /linkedin/make-viral
router.post("/make-viral", requireAuth, async (req, res) => {
  const { post } = req.body as { post?: unknown };

  if (typeof post !== "string" || post.trim().length < 10) {
    res.status(400).json({ error: "post must be a string of at least 10 characters" });
    return;
  }

  const safePost = post.trim().slice(0, 3000);

  try {
    const prompt = `You are a LinkedIn virality expert. Rewrite this post to maximize engagement, shares, and comments. Make the hook irresistible, add emotional resonance, use pattern interrupts, and end with a strong CTA.

Original post:
${safePost}

Return ONLY valid JSON with exactly these fields:
{
  "hook": "<New irresistible first line — max 15 words, creates immediate curiosity>",
  "post": "<Rewritten viral version, 180-250 words, punchier sentences, more emotional, more shareable. Short paragraphs, natural emojis, ends with a strong question or CTA.>",
  "hashtags": ["<hashtag1>", "<hashtag2>", "<hashtag3>", "<hashtag4>", "<hashtag5>"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let result: { hook: string; post: string; hashtags: string[] };

    try {
      result = JSON.parse(content) as typeof result;
    } catch {
      result = {
        hook: "This changes everything — and most people aren't ready.",
        post: safePost,
        hashtags: ["#Viral", "#LinkedIn", "#Growth", "#Success", "#Mindset"],
      };
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error making post viral");
    res.status(500).json({ error: "Failed to enhance post" });
  }
});

export default router;
