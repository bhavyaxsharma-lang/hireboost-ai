// Interview session routes
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db, interviewSessions, interviewQuestions } from "@workspace/db";
import { eq, desc, isNull, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateInterviewSessionBody,
  GetInterviewSessionParams,
  SubmitAnswerBody,
  SubmitAnswerParams,
  CompleteInterviewSessionParams,
} from "@workspace/api-zod";

const router = Router();
const isMockMode = process.env.MOCK_RESPONSES === "true";
const mockSessions = new Map<number, ReturnType<typeof formatSession>>();

// Helper to format session with questions
function formatSession(session: typeof interviewSessions.$inferSelect, questions: typeof interviewQuestions.$inferSelect[]) {
  return {
    id: session.id,
    userId: session.userId,
    jobRole: session.jobRole,
    difficulty: session.difficulty,
    status: session.status,
    averageRating: session.averageRating,
    totalQuestions: session.totalQuestions,
    answeredQuestions: session.answeredQuestions,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    questions: questions.map((q) => ({
      id: q.id,
      sessionId: q.sessionId,
      questionText: q.questionText,
      questionIndex: q.questionIndex,
      userAnswer: q.userAnswer,
      aiFeedback: q.aiFeedback,
      sampleAnswer: q.sampleAnswer,
      rating: q.rating,
    })),
  };
}

function buildMockSession(sessionId: number, userId: number, jobRole: string, difficulty: string, questionTexts: string[]) {
  const questions = questionTexts.map((questionText, index) => ({
    id: sessionId * 100 + index + 1,
    sessionId,
    questionText,
    questionIndex: index,
    userAnswer: null,
    aiFeedback: null,
    sampleAnswer: null,
    rating: null,
  }));

  return {
    id: sessionId,
    userId,
    jobRole,
    difficulty,
    status: "in_progress",
    averageRating: null,
    totalQuestions: questions.length,
    answeredQuestions: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    questions,
  } as const;
}

// GET /interview/sessions
router.get("/sessions", requireAuth,async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

  if (isMockMode) {
    res.json(Array.from(mockSessions.values()));
    return;
  }

  try {
    const sessions = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .orderBy(desc(interviewSessions.createdAt))
      .limit(20);

    res.json(
      sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        jobRole: s.jobRole,
        difficulty: s.difficulty,
        status: s.status,
        averageRating: s.averageRating,
        totalQuestions: s.totalQuestions,
        answeredQuestions: s.answeredQuestions,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Error listing interview sessions");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// POST /interview/sessions - create session + generate questions
router.post("/sessions", requireAuth, async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

  const parseResult = CreateInterviewSessionBody.safeParse(req.body);
  if (!parseResult.success) {
   

    res.status(400).json({
      error: "Invalid request body",
      details: parseResult.error.format(),
    });

    return;
  }

  const { jobRole, difficulty = "medium", questionCount = 7 } = parseResult.data;

  try {
    let questionTexts: string[];

    if (isMockMode) {
      questionTexts = ["Explain REFramework in UiPath."];
      while (questionTexts.length < questionCount) {
        questionTexts.push("Describe a key UiPath automation challenge you've solved.");
      }
    } else {
      // Generate questions with AI
      const prompt = `Generate exactly ${questionCount} interview questions for a ${difficulty} difficulty ${jobRole} interview.
Return ONLY a JSON array of strings, no markdown, no explanation.
Example: ["Question 1?", "Question 2?"]
Mix behavioral, technical, and situational questions appropriate for the role.`;

      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });
   

      const content = completion.choices[0]?.message?.content ?? "[]";

     

      try {
        questionTexts = JSON.parse(content) as string[];
      } catch (err) {
       
        questionTexts = [
          `Tell me about your experience with ${jobRole}.`,
          "What are your greatest technical strengths?",
          "Describe a challenging project you worked on.",
          "How do you handle tight deadlines?",
          "Where do you see yourself in 5 years?",
        ];
      }
    }

    // Ensure we have the right count
    while (questionTexts.length < questionCount) {
      questionTexts.push(`Describe your experience with a key aspect of the ${jobRole} role.`);
    }
    questionTexts = questionTexts.slice(0, questionCount);

    if (isMockMode) {
      const sessionId = mockSessions.size + 1;
      const session = buildMockSession(sessionId, userId, jobRole, difficulty, questionTexts);
      mockSessions.set(sessionId, session);
      res.status(201).json(session);
      return;
    }

    // Create session
    const [session] = await db.insert(interviewSessions).values({
      userId,
      jobRole,
      difficulty,
      status: "in_progress",
      totalQuestions: questionTexts.length,
      answeredQuestions: 0,
    }).returning();

    // Insert questions
    const questionsToInsert = questionTexts.map((text, index) => ({
      sessionId: session.id,
      questionText: text,
      questionIndex: index,
    }));

    const insertedQuestions = await db.insert(interviewQuestions).values(questionsToInsert).returning();

    res.status(201).json(formatSession(session, insertedQuestions));
  } catch (error) {
    

    res.status(500).json({
      error: "Failed to create interview session",
    });
  }
});

// GET /interview/sessions/:id
router.get("/sessions/:id", requireAuth, async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

  const parseResult = GetInterviewSessionParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    if (isMockMode) {
      const session = mockSessions.get(parseResult.data.id);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      res.json(session);
      return;
    }

    const [session] = await db.select().from(interviewSessions).where(and(eq(interviewSessions.id, parseResult.data.id), eq(interviewSessions.userId, userId))).limit(1);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    

    const questions = await db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.sessionId, session.id))
      .orderBy(interviewQuestions.questionIndex);

    res.json(formatSession(session, questions));
  } catch (err) {
    req.log.error({ err }, "Error getting interview session");
    res.status(500).json({ error: "Failed to get session" });
  }
});

// POST /interview/sessions/:id/answer - submit answer and get AI feedback
router.post("/sessions/:id/answer", requireAuth, async (req, res) => {
  const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

  const paramsResult = SubmitAnswerParams.safeParse({ id: Number(req.params.id) });
  if (!paramsResult.success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const bodyResult = SubmitAnswerBody.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { questionId, answer } = bodyResult.data;
  const sessionId = paramsResult.data.id;

  // Reserved server-internal marker used to atomically claim a question row
  // before calling OpenAI. Declared outside try/catch so both blocks can
  // reference it. Never stored permanently — overwritten by the real answer
  // on success, or cleared back to NULL on failure.
  const SENTINEL = "__EVALUATING__";

  try {
    if (isMockMode) {
      const session = mockSessions.get(sessionId);
      if (!session || session.userId !== userId) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const question = session.questions.find((q: any) => q.id === questionId);
      if (!question) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      if (question.userAnswer) {
        res.status(409).json({ error: "This question has already been answered." });
        return;
      }

      question.userAnswer = answer;
      question.aiFeedback = "Good effort! Keep practicing to improve your responses.";
      question.sampleAnswer = "A strong answer would use the STAR method: describe the Situation, explain the Task you were responsible for, detail the Actions you took, and share the measurable Results you achieved.";
      question.rating = 4;

      session.answeredQuestions += 1;
      session.averageRating = 4;

      res.json({
        questionId,
        feedback: question.aiFeedback,
        rating: question.rating,
        suggestions: ["Be more specific", "Use the STAR method", "Show impact with numbers"],
        sampleAnswer: question.sampleAnswer,
      });
      return;
    }

    // Verify session ownership before allowing writes
    const [sessionOwner] = await db.select({ userId: interviewSessions.userId }).from(interviewSessions).where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, userId))).limit(1);
    if (!sessionOwner) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Verify the question exists and belongs to this session
    const [question] = await db.select().from(interviewQuestions).where(eq(interviewQuestions.id, questionId)).limit(1);
    if (!question || question.sessionId !== sessionId) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    // Atomically claim the question before calling OpenAI to prevent TOCTOU races.
    // The UPDATE only succeeds when user_answer IS NULL; any concurrent request
    // that already set it (to the sentinel or a real answer) returns 0 rows and
    // gets a 409 without triggering any AI spend.
    const claimed = await db
      .update(interviewQuestions)
      .set({ userAnswer: SENTINEL })
      .where(and(eq(interviewQuestions.id, questionId), isNull(interviewQuestions.userAnswer)))
      .returning({ id: interviewQuestions.id });

    if (claimed.length === 0) {
      res.status(409).json({ error: "This question has already been answered." });
      return;
    }

    // Get AI feedback
    const prompt = `You are an expert interview coach. Evaluate this interview answer and provide a sample model answer.

Question: ${question.questionText}

Candidate's Answer: ${answer}

Return ONLY valid JSON with exactly these fields:
{
  "feedback": "<2-3 sentence specific, constructive feedback on the candidate's answer>",
  "rating": <integer 1-5>,
  "suggestions": [<2-3 specific improvement tips>],
  "sampleAnswer": "<A strong model answer for this question using the STAR method or best practice structure, 3-6 sentences, specific and compelling — this is an ideal reference answer the candidate can learn from>"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let feedbackData: { feedback: string; rating: number; suggestions: string[]; sampleAnswer: string };

    try {
      feedbackData = JSON.parse(content) as typeof feedbackData;
    } catch {
      feedbackData = {
        feedback: "Good effort! Keep practicing to improve your responses.",
        rating: 3,
        suggestions: ["Be more specific", "Use the STAR method", "Show impact with numbers"],
        sampleAnswer: "A strong answer would use the STAR method: describe the Situation, explain the Task you were responsible for, detail the Actions you took, and share the measurable Results you achieved.",
      };
    }

    // Clamp rating 1-5
    feedbackData.rating = Math.max(1, Math.min(5, Math.round(feedbackData.rating)));

    // Update the question with the answer, feedback, and sample answer
    await db.update(interviewQuestions)
      .set({
        userAnswer: answer,
        aiFeedback: feedbackData.feedback,
        sampleAnswer: feedbackData.sampleAnswer ?? null,
        rating: feedbackData.rating,
      })
      .where(eq(interviewQuestions.id, questionId));

    // Update session answered count
    const [session] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, sessionId)).limit(1);
    if (session) {
      const newAnsweredCount = session.answeredQuestions + 1;
      await db.update(interviewSessions)
        .set({ answeredQuestions: newAnsweredCount })
        .where(eq(interviewSessions.id, sessionId));
    }

    res.json({
      questionId,
      feedback: feedbackData.feedback,
      rating: feedbackData.rating,
      suggestions: feedbackData.suggestions,
      sampleAnswer: feedbackData.sampleAnswer,
    });
  } catch (err) {
    req.log.error({ err }, "Error submitting answer");
    // Reset the sentinel so the user can retry — the claim was not yet finalised.
    await db
      .update(interviewQuestions)
      .set({ userAnswer: null })
      .where(and(eq(interviewQuestions.id, questionId), eq(interviewQuestions.userAnswer, SENTINEL)))
      .catch((resetErr) => req.log.error({ resetErr }, "Failed to reset question sentinel after error"));
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
});

// POST /interview/sessions/:id/complete - complete session
router.post("/sessions/:id/complete",requireAuth, async (req, res) => {
const userId = req.userId;

if (!userId) {
  return res.status(401).json({
    error: "Authentication required",
  });
}

  const parseResult = CompleteInterviewSessionParams.safeParse({ id: Number(req.params.id) });
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  try {
    const [session] = await db.select().from(interviewSessions).where(and(eq(interviewSessions.id, parseResult.data.id), eq(interviewSessions.userId, userId))).limit(1);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (session.status === "completed") {
  return res.status(400).json({
    error: "Interview already completed",
  });
}

    // Calculate average rating from answered questions
    const questions = await db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.sessionId, session.id));

    const ratedQuestions = questions.filter((q) => q.rating !== null);
    const avgRating = ratedQuestions.length > 0
      ? ratedQuestions.reduce((sum, q) => sum + (q.rating ?? 0), 0) / ratedQuestions.length
      : null;

    const [updated] = await db.update(interviewSessions)
      .set({
        status: "completed",
        completedAt: new Date(),
        averageRating: avgRating,
        answeredQuestions: ratedQuestions.length,
      })
      .where(eq(interviewSessions.id, parseResult.data.id))
      .returning();

    res.json({
      id: updated.id,
      userId: updated.userId,
      jobRole: updated.jobRole,
      difficulty: updated.difficulty,
      status: updated.status,
      averageRating: updated.averageRating,
      totalQuestions: updated.totalQuestions,
      answeredQuestions: updated.answeredQuestions,
      createdAt: updated.createdAt,
      completedAt: updated.completedAt,
    });
  } catch (err) {
    

    res.status(500).json({
      error: "Failed to complete interview",
    });
  }
});

export default router;
