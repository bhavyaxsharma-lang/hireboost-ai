import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Sparkles, ChevronDown, ChevronUp,
  Briefcase, Tag, Lightbulb, MessageSquareQuote,
  ClipboardList, Info,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Technical: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Behavioral: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  Situational: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Role-Specific": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "Culture Fit": "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

type JDResult = {
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

function QuestionCard({ q, index }: { q: JDResult["questions"][number]; index: number }) {
  const [open, setOpen] = useState(false);
  const colorClass = CATEGORY_COLORS[q.category] ?? "bg-muted text-muted-foreground border-border";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full text-left"
        >
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="font-semibold text-foreground leading-snug">{q.question}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${colorClass}`}>
                    <Tag className="h-3 w-3" />{q.category}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />{q.whyAsked}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-muted-foreground pt-0.5">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <CardContent className="px-5 pb-5 pt-0 space-y-4 border-t border-border/40">
                {/* Model Answer */}
                <div className="space-y-1.5 mt-4">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <MessageSquareQuote className="h-4 w-4 text-primary" /> Model Answer
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 rounded-lg p-3 border border-border/30">
                    {q.modelAnswer}
                  </p>
                </div>

                {/* Tips */}
                {q.tips?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Lightbulb className="h-4 w-4 text-amber-500" /> Tips
                    </div>
                    <ul className="space-y-1">
                      {q.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function JDPrep() {
  const { toast } = useToast();
  const [jobDescription, setJobDescription] = useState("");
  const [questionCount, setQuestionCount] = useState("8");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<JDResult | null>(null);

  const handleGenerate = async () => {
    if (jobDescription.trim().length < 50) {
      toast({ title: "JD too short", description: "Please paste the full job description (at least 50 characters).", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/interview/jd-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, questionCount: Number(questionCount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Something went wrong.", variant: "destructive" });
        return;
      }
      setResult(data as JDResult);
    } catch {
      toast({ title: "Network error", description: "Could not connect. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setJobDescription("");
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-primary" />
          JD Interview Prep
        </h1>
        <p className="text-muted-foreground mt-1">
          Paste any job description and get tailored interview questions with model answers.
        </p>
      </div>

      {/* Input section */}
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="jd" className="text-sm font-semibold">Job Description</Label>
            <Textarea
              id="jd"
              placeholder="Paste the full job description here — the more detail you include, the more accurate the questions will be..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[260px] resize-none font-mono text-sm leading-relaxed"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground text-right">
              {jobDescription.length} characters
              {jobDescription.length < 50 && jobDescription.length > 0 && (
                <span className="text-destructive ml-1">— need at least 50</span>
              )}
            </p>
          </div>

          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1.5 w-56">
              <Label className="text-sm font-semibold">Number of Questions</Label>
              <Select value={questionCount} onValueChange={setQuestionCount} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Questions — Quick prep</SelectItem>
                  <SelectItem value="8">8 Questions — Standard</SelectItem>
                  <SelectItem value="10">10 Questions — Thorough</SelectItem>
                  <SelectItem value="12">12 Questions — Deep dive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading || jobDescription.trim().length < 50}
              className="h-10 px-6 font-bold shadow-lg shadow-primary/20 gap-2"
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing JD…</>
                : <><Sparkles className="h-4 w-4" /> Generate Questions</>
              }
            </Button>
          </div>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 space-y-4 text-muted-foreground"
            >
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Analysing your job description…</p>
              <p className="text-xs">The AI is reading the JD and crafting tailored questions for you</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* JD Analysis card */}
          <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-primary" /> JD Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Role</p>
                  <p className="font-semibold text-foreground">{result.analysis.roleTitle}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Seniority</p>
                  <p className="font-semibold text-foreground">{result.analysis.seniority}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Industry</p>
                  <p className="font-semibold text-foreground">{result.analysis.industry}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Key Skills Required</p>
                <div className="flex flex-wrap gap-2">
                  {result.analysis.keySkills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs font-medium">{skill}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">What They're Looking For</p>
                <p className="text-sm text-foreground leading-relaxed">{result.analysis.summary}</p>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {result.questions.length} Tailored Interview Questions
              </h2>
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                <ClipboardList className="h-4 w-4" /> New JD
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Click any question to reveal the model answer and tips.</p>

            <div className="space-y-3">
              {result.questions.map((q, i) => (
                <QuestionCard key={i} q={q} index={i} />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
