import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetInterviewSession,
  useSubmitAnswer,
  useCompleteInterviewSession,
  getGetInterviewSessionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Send,
  Star,
  CheckCircle2,
  User,
  Sparkles,
  ChevronRight,
  Trophy,
  Lightbulb,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   TypingIndicator — 3 pulsing dots, ChatGPT style
───────────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex items-end gap-3 max-w-[85%]"
    >
      {/* AI avatar */}
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25 mb-1">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      {/* Dots */}
      <div className="flex items-center gap-1.5 bg-secondary px-5 py-4 rounded-2xl rounded-bl-sm">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-muted-foreground"
            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   StarRating display
───────────────────────────────────────────────────────── */
function StarRating({ rating }: { rating: number | null | undefined }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            rating && star <= rating
              ? "text-amber-400 fill-amber-400"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Interview Session page
───────────────────────────────────────────────────────── */
export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

if (!Number.isInteger(sessionId) || sessionId <= 0) {
  return (
    <div className="p-8 text-center">
      Invalid interview session.
    </div>
  );
}
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: session, isLoading } = useGetInterviewSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetInterviewSessionQueryKey(sessionId) },
  });

  const submitMutation = useSubmitAnswer();
  const completeMutation = useCompleteInterviewSession();

  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.questions, isSubmitting]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center flex-col gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your interview...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Session not found.</p>
        <Button className="mt-4" onClick={() => setLocation("/interview")}>
          Back to Interviews
        </Button>
      </div>
    );
  }

  // Find first unanswered question
  const currentQuestionIndex = session.questions.findIndex((q) => !q.userAnswer);
  const isCompleted = session.status === "completed" || currentQuestionIndex === -1;
  const currentQuestion = !isCompleted ? session.questions[currentQuestionIndex] : null;
  

  const handleSubmit = async () => {
    if (!currentAnswer.trim() || !currentQuestion || isSubmitting) return;

    setIsSubmitting(true);
    // Small delay so the scroll picks up typing indicator
    await new Promise((r) => setTimeout(r, 50));

    submitMutation.mutate(
      { id: sessionId, data: { questionId: currentQuestion.id, answer: currentAnswer } },
      {
        onSuccess: () => {
          setCurrentAnswer("");
          setIsSubmitting(false);
          queryClient.invalidateQueries({
            queryKey: getGetInterviewSessionQueryKey(sessionId),
          });

          // Auto-complete if last question
          const isLastQuestion =
            session.answeredQuestions + 1 >= session.totalQuestions;
          if (isLastQuestion) {
            completeMutation.mutate({ id: sessionId }, {
              onSuccess: () => {
                queryClient.invalidateQueries({
                  queryKey: getGetInterviewSessionQueryKey(sessionId),
                });
                toast({ title: "Interview complete! Great work." });
              },
            });
          }
        },
        onError: () => {
          setIsSubmitting(false);
          toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleFinishEarly = () => {
    if (!confirm("End the interview early?")) return;
    completeMutation.mutate({ id: sessionId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInterviewSessionQueryKey(sessionId) });
        toast({ title: "Interview ended." });
      },
    });
  };

  // Visible questions: all answered + current
  const visibleQuestions = session.questions.filter(
    (_, idx) => idx <= (currentQuestionIndex === -1 ? session.questions.length - 1 : currentQuestionIndex)
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-4xl mx-auto w-full">

      {/* ── Header ── */}
      <div className="flex-none px-4 py-3 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">{session.jobRole}</h2>
              <Badge variant="secondary" className="text-xs capitalize">{session.difficulty}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.answeredQuestions} of {session.totalQuestions} questions answered
            </p>
          </div>
          {isCompleted ? (
            <Button size="sm" onClick={() => setLocation("/dashboard")}>
              Dashboard <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={handleFinishEarly}>
              End Early
            </Button>
          )}
        </div>

        {/* Segmented progress bar */}
        <div className="flex gap-1">
          {session.questions.map((q, i) => (
            <div
              key={q.id}
              className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                q.userAnswer
                  ? "bg-primary"
                  : i === currentQuestionIndex
                  ? "bg-primary/30"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Chat messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5" style={{ scrollBehavior: "smooth" }}>

        {/* Intro message */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end gap-3"
        >
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="bg-secondary text-secondary-foreground px-4 py-3 rounded-2xl rounded-bl-sm text-sm max-w-[80%]">
            Welcome to your <strong>{session.jobRole}</strong> mock interview. I'll ask you{" "}
            <strong>{session.totalQuestions}</strong> questions. Take your time and answer thoughtfully.
          </div>
        </motion.div>

        {/* Q&A pairs */}
        {visibleQuestions.map((q) => (
          <div key={q.id} className="space-y-4">

            {/* Question bubble (AI) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-end gap-3 max-w-[88%]"
            >
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25 mb-1 shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-1 ml-1">
                  Question {q.questionIndex + 1}
                </p>
                <div className="bg-secondary text-secondary-foreground px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed">
                  {q.questionText}
                </div>
              </div>
            </motion.div>

            {/* User answer bubble */}
            {q.userAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-3 justify-end"
              >
                <div className="max-w-[82%]">
                  <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap">
                    {q.userAnswer}
                  </div>
                </div>
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-accent flex items-center justify-center mb-1 shrink-0">
                  <User className="h-4 w-4 text-accent-foreground" />
                </div>
              </motion.div>
            )}

            {/* AI feedback bubble */}
            {q.aiFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-end gap-3 max-w-[90%]"
              >
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25 mb-1 shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <Card className="border border-border/60 shadow-sm flex-1">
                  <CardContent className="p-4 space-y-4">
                    {/* Feedback section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          AI Feedback
                        </span>
                        <StarRating rating={q.rating} />
                      </div>
                      <p className="text-sm leading-relaxed">{q.aiFeedback}</p>
                      {q.rating != null && (
                        <div
                          className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
                            q.rating >= 4
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : q.rating === 3
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {q.rating >= 4 ? "Strong answer" : q.rating === 3 ? "Good effort" : "Needs improvement"}
                        </div>
                      )}
                    </div>

                    {/* Sample answer section */}
                    {q.aiFeedback && (
                      <div className="border-t border-border/50 pt-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            Sample Answer
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground italic bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                          {q.aiFeedback}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        ))}

        {/* Typing indicator — shown while AI generates feedback */}
        <AnimatePresence>
          {isSubmitting && <TypingIndicator />}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <AnimatePresence mode="wait">
        {!isCompleted && currentQuestion && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-none border-t bg-background/95 backdrop-blur p-4"
          >
            <div className="max-w-3xl mx-auto flex gap-3 items-end">
              <Textarea
                ref={textareaRef}
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="Type your answer... (Ctrl/Cmd+Enter to submit)"
                className="resize-none min-h-[72px] max-h-[200px] text-sm"
                disabled={isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                data-testid="answer-textarea"
              />
              <Button
                onClick={handleSubmit}
                disabled={!currentAnswer.trim() || isSubmitting}
                className="h-12 w-12 shrink-0 p-0"
                data-testid="submit-answer-button"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Completed state */}
        {isCompleted && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-none border-t bg-background p-6"
          >
            <div className="max-w-sm mx-auto text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-primary/10">
                  <Trophy className="h-10 w-10 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Interview Complete</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  You answered {session.answeredQuestions} of {session.totalQuestions} questions.
                </p>
              </div>
              {session.averageRating != null && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <StarRating rating={Math.round(session.averageRating)} />
                    <span className="font-bold text-lg">{session.averageRating.toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">/ 5.0</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Average rating</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setLocation("/dashboard")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setLocation("/interview")}>
                  New Interview
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
