import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useAnalyzeResume,
  useGetResumeDailyUsage,
  getGetResumeDailyUsageQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Target,
  LayoutTemplate,
  Zap,
  Lock,
  Sparkles,
  TrendingUp,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Circular ATS Score Ring — SVG-based animated ring
───────────────────────────────────────────────────────── */
function ATSScoreRing({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = 70;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Color based on score
  const color =
    score >= 75 ? "#84cc16" : score >= 50 ? "#f59e0b" : "#ef4444";

  useEffect(() => {
    // Animate number counting up
    let start = 0;
    const duration = 1200;
    const step = 16;
    const increment = score / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(start));
      }
    }, step);
    return () => clearInterval(timer);
  }, [score]);

  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={radius * 2} height={radius * 2} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        {/* Animated progress arc */}
        <motion.circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="transparent"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>

      {/* Score number overlay */}
      <div className="absolute flex flex-col items-center">
        <span
          className="text-5xl font-black tabular-nums leading-none"
          style={{ color }}
        >
          {displayScore}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
          ATS Score
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Typing Indicator — pulsing dots shown while AI generates
───────────────────────────────────────────────────────── */
function AiThinkingLoader() {
  return (
    <div className="flex items-center gap-1.5 px-5 py-4 bg-secondary rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-primary"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Upgrade to Pro modal
───────────────────────────────────────────────────────── */
function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const features = [
    "Unlimited resume scans per day",
    "Priority AI processing (faster results)",
    "Advanced ATS keyword matching",
    "Personalized cover letter generator",
    "Unlimited mock interview sessions",
    "LinkedIn profile optimizer",
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">Upgrade to Pro</DialogTitle>
          </div>
          <DialogDescription>
            Unlock unlimited scans and premium features to land your dream job faster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pricing card */}
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 text-center">
            <div className="text-3xl font-black text-primary">$9.99</div>
            <div className="text-sm text-muted-foreground">per month — cancel anytime</div>
          </div>

          {/* Features list */}
          <ul className="space-y-2">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Button className="w-full" size="lg">
            <Sparkles className="mr-2 h-4 w-4" />
            Start Free 7-Day Trial
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No credit card required for trial
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────
   Usage Banner — shown at top of page
───────────────────────────────────────────────────────── */
function UsageBanner({
  used,
  limit,
  onUpgrade,
}: {
  used: number;
  limit: number;
  onUpgrade: () => void;
}) {
  const remaining = limit - used;
  const isExhausted = remaining <= 0;
  const isLow = remaining === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        isExhausted
          ? "border-destructive/40 bg-destructive/5"
          : isLow
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {isExhausted ? (
          <Lock className="h-4 w-4 text-destructive shrink-0" />
        ) : (
          <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className={isExhausted ? "text-destructive font-medium" : "text-muted-foreground"}>
          {isExhausted
            ? "Daily limit reached — upgrade for unlimited scans"
            : `${remaining} free scan${remaining !== 1 ? "s" : ""} remaining today (${used}/${limit} used)`}
        </span>
      </div>
      <Button
        size="sm"
        variant={isExhausted ? "default" : "outline"}
        onClick={onUpgrade}
        className="shrink-0"
      >
        <Zap className="mr-1.5 h-3.5 w-3.5" />
        Upgrade to Pro
      </Button>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Resume Analyzer page
───────────────────────────────────────────────────────── */
export default function ResumeAnalyzer() {
  const [resumeText, setResumeText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<{
    atsScore: number;
    missingKeywords: string[];
    suggestions: string[];
    strengths: string[];
    overallFeedback: string;
  } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch daily usage
  const { data: usageData } = useGetResumeDailyUsage();
  const analyzeMutation = useAnalyzeResume();

  const isAnalyzing = analyzeMutation.isPending;
  const isLimitReached = usageData ? usageData.used >= usageData.limit : false;

  const handleAnalyze = () => {
    if (!resumeText.trim()) {
      toast({ title: "Missing content", description: "Please paste your resume text.", variant: "destructive" });
      return;
    }
    if (isLimitReached) {
      setShowUpgrade(true);
      return;
    }

    analyzeMutation.mutate(
      { data: { resumeText, jobTitle: jobTitle || undefined, jobDescription: jobDescription || undefined } },
      {
        onSuccess: (data) => {
          setResult({
            atsScore: data.atsScore,
            missingKeywords: data.missingKeywords,
            suggestions: data.suggestions,
            strengths: data.strengths,
            overallFeedback: data.overallFeedback,
          });
          // Refresh usage count after successful analysis
          queryClient.invalidateQueries({ queryKey: getGetResumeDailyUsageQueryKey() });
          toast({ title: "Analysis complete!" });
        },
        onError: (err: { status?: number; data?: { error?: string } }) => {
          if (err.status === 429) {
            setShowUpgrade(true);
            toast({ title: "Daily limit reached", description: "Upgrade to Pro for unlimited scans.", variant: "destructive" });
          } else {
            toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
          }
        },
      }
    );
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } },
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resume Analyzer</h1>
        <p className="text-muted-foreground mt-1">Get an instant ATS score and tailored improvements powered by AI.</p>
      </div>

      {/* Usage banner */}
      {usageData && (
        <UsageBanner used={usageData.used} limit={usageData.limit} onUpgrade={() => setShowUpgrade(true)} />
      )}

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Resume text input */}
              <Card className="lg:col-span-2 border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Resume Content
                  </CardTitle>
                  <CardDescription>Paste your full resume text to begin analysis.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Paste your resume here..."
                    className="min-h-[380px] font-mono text-sm resize-y"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    disabled={isAnalyzing}
                    data-testid="resume-textarea"
                  />
                </CardContent>
              </Card>

              {/* Target role + action */}
              <div className="space-y-4">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-4 w-4 text-primary" /> Target Role
                    </CardTitle>
                    <CardDescription>Optional — improves keyword matching.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        placeholder="e.g. RPA Developer"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        disabled={isAnalyzing}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="jobDescription">Job Description</Label>
                      <Textarea
                        id="jobDescription"
                        placeholder="Paste the job description..."
                        className="min-h-[120px] text-sm resize-y"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        disabled={isAnalyzing}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !resumeText.trim() || isLimitReached}
                      data-testid="analyze-button"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : isLimitReached ? (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Limit Reached
                        </>
                      ) : (
                        <>
                          <LayoutTemplate className="mr-2 h-4 w-4" />
                          Analyze Resume
                        </>
                      )}
                    </Button>
                    {isLimitReached && (
                      <Button variant="outline" className="w-full" onClick={() => setShowUpgrade(true)}>
                        <Zap className="mr-2 h-4 w-4 text-primary" />
                        Upgrade to Pro
                      </Button>
                    )}
                  </CardFooter>
                </Card>

                {/* Upgrade to Pro teaser card */}
                {!isLimitReached && (
                  <Card
                    className="border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setShowUpgrade(true)}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/20">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Upgrade to Pro</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Unlimited scans, faster AI & more tools.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* AI thinking loader shown while analyzing */}
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 flex items-start gap-4"
                >
                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">AI is reading your resume...</p>
                    <AiThinkingLoader />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ──── Results View ──── */
          <motion.div
            key="results"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setResult(null)}>
                Analyze Another
              </Button>
              <Link href="/history">
                <Button variant="ghost" size="sm">
                  View History <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Score + Overall feedback */}
            <div className="grid md:grid-cols-3 gap-5">
              <motion.div variants={itemVariants}>
                <Card className="h-full flex flex-col items-center justify-center border-border/50 shadow-sm py-6">
                  <div className="relative flex items-center justify-center">
                    <ATSScoreRing score={result.atsScore} />
                  </div>
                  <Badge
                    className="mt-4"
                    variant={
                      result.atsScore >= 75 ? "default" : result.atsScore >= 50 ? "secondary" : "destructive"
                    }
                  >
                    {result.atsScore >= 75
                      ? "Strong Match"
                      : result.atsScore >= 50
                      ? "Needs Work"
                      : "Low Match"}
                  </Badge>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants} className="md:col-span-2">
                <Card className="h-full border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle>Overall Feedback</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{result.overallFeedback}</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Keywords + Strengths */}
            <div className="grid md:grid-cols-2 gap-5">
              <motion.div variants={itemVariants}>
                <Card className="h-full border-border/50 shadow-sm border-t-4 border-t-destructive/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertCircle className="h-4 w-4 text-destructive" /> Missing Keywords
                    </CardTitle>
                    <CardDescription>Add these to boost your ATS score.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.missingKeywords.map((kw, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                          <span className="font-medium">{kw}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="h-full border-border/50 shadow-sm border-t-4 border-t-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> Key Strengths
                    </CardTitle>
                    <CardDescription>What your resume does well.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.strengths.map((s, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          <span>{s}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Suggestions */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50 shadow-sm border-t-4 border-t-blue-500">
                <CardHeader>
                  <CardTitle>Actionable Suggestions</CardTitle>
                  <CardDescription>Implement these to improve your score.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.suggestions.map((sug, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex gap-3 bg-muted/50 p-3 rounded-lg text-sm"
                      >
                        <span className="font-bold text-blue-500 shrink-0">{i + 1}.</span>
                        <span>{sug}</span>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade modal */}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
