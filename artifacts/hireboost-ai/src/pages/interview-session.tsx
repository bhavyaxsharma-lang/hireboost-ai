import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGetInterviewSession, useSubmitAnswer, useCompleteInterviewSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, Star, ArrowRight, CheckCircle2, User, Bot } from "lucide-react";

export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading, refetch } = useGetInterviewSession(sessionId, {
    query: {
      enabled: !!sessionId
    }
  });

  const submitMutation = useSubmitAnswer();
  const completeMutation = useCompleteInterviewSession();

  const [currentAnswer, setCurrentAnswer] = useState("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.questions]);

  if (isLoading) {
    return <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!session) {
    return <div className="p-8 text-center">Session not found.</div>;
  }

  // Find the first unanswered question
  const currentQuestionIndex = session.questions.findIndex(q => !q.userAnswer);
  const isCompleted = session.status === "completed" || currentQuestionIndex === -1;
  const currentQuestion = !isCompleted ? session.questions[currentQuestionIndex] : null;
  const progressPercentage = (session.answeredQuestions / session.totalQuestions) * 100;

  const handleSubmit = () => {
    if (!currentAnswer.trim() || !currentQuestion) return;

    submitMutation.mutate(
      {
        data: {
          questionId: currentQuestion.id,
          answer: currentAnswer
        }
      },
      {
        onSuccess: () => {
          setCurrentAnswer("");
          refetch();
          
          // If it was the last question, auto-complete
          if (session.answeredQuestions + 1 === session.totalQuestions) {
            handleComplete();
          }
        },
        onError: (err) => {
          toast({
            title: "Submission failed",
            description: err.error || "Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleComplete = () => {
    completeMutation.mutate(
      undefined,
      {
        onSuccess: () => {
          refetch();
          toast({ title: "Interview completed!" });
        }
      }
    );
  };

  const handleFinishEarly = () => {
    if (confirm("Are you sure you want to end the interview early?")) {
      handleComplete();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto w-full">
      <div className="flex-none p-4 border-b bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg">{session.jobRole} Interview</h2>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="capitalize">{session.difficulty} Mode</span>
              <span>•</span>
              <span>{session.answeredQuestions} / {session.totalQuestions} Answered</span>
            </div>
          </div>
          {isCompleted ? (
            <Button variant="default" onClick={() => setLocation("/dashboard")}>Return to Dashboard</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleFinishEarly} className="text-muted-foreground">
              End Early
            </Button>
          )}
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-32">
        {session.questions.map((q, idx) => {
          const isVisible = idx <= (currentQuestionIndex === -1 ? session.questions.length : currentQuestionIndex);
          if (!isVisible) return null;

          return (
            <div key={q.id} className="space-y-6">
              {/* Question bubble */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 max-w-[85%]"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="bg-secondary text-secondary-foreground px-5 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Question {q.questionIndex}</div>
                  <p className="leading-relaxed">{q.questionText}</p>
                </div>
              </motion.div>

              {/* Answer bubble */}
              {q.userAnswer && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 max-w-[85%] ml-auto flex-row-reverse"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                    <User className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div className="bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-sm shadow-sm">
                    <p className="leading-relaxed whitespace-pre-wrap">{q.userAnswer}</p>
                  </div>
                </motion.div>
              )}

              {/* Feedback bubble */}
              {q.aiFeedback && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex gap-4 max-w-[85%]"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <Card className="bg-card border-border shadow-sm flex-1">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="font-semibold flex items-center gap-2">
                          Feedback
                        </div>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`h-4 w-4 ${q.rating && star <= q.rating ? "text-yellow-500 fill-yellow-500" : "text-muted fill-muted"}`} 
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.aiFeedback}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {!isCompleted && currentQuestion && (
        <div className="flex-none p-4 bg-background border-t">
          <div className="max-w-4xl mx-auto flex gap-4">
            <Textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="resize-none min-h-[80px] max-h-[200px]"
              disabled={submitMutation.isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <Button 
              onClick={handleSubmit} 
              disabled={!currentAnswer.trim() || submitMutation.isPending}
              className="h-auto shrink-0 px-6"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Send className="h-5 w-5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Submit</span>
                </div>
              )}
            </Button>
          </div>
          <div className="text-center mt-2 text-xs text-muted-foreground">Press Cmd/Ctrl + Enter to submit</div>
        </div>
      )}

      {isCompleted && (
        <div className="flex-none p-6 bg-secondary text-center border-t">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold mb-1">Interview Completed</h3>
          <p className="text-muted-foreground mb-4">You've answered all questions. Great job!</p>
          <div className="text-2xl font-bold mb-4">
            Average Rating: {session.averageRating?.toFixed(1)} / 5.0
          </div>
          <Button onClick={() => setLocation("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
