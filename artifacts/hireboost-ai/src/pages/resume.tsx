import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  useAnalyzeResume,
  useGetResumeDailyUsage,
  getGetResumeDailyUsageQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Loader2, AlertCircle, CheckCircle2, ChevronRight,
  Target, LayoutTemplate, Zap, Lock, Sparkles, TrendingUp,
  Upload, X, FileType, Eye, EyeOff, Copy, Download, Wand2,
  IndianRupee,
} from "lucide-react";
import { RoleCombobox } from "@/components/role-combobox";

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => { open(): void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface ParsedFile {
  text: string;
  wordCount: number;
  fileName: string;
  fileType: "pdf" | "docx";
}

type AnalysisResult = {
  atsScore: number;
  missingKeywords: string[];
  suggestions: string[];
  strengths: string[];
  overallFeedback: string;
};

type AutoFixState = "idle" | "paying" | "rewriting" | "done";

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
function getApiBase() {
  return (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";
}

async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/* ─────────────────────────────────────────────────────────
   Circular ATS Score Ring
───────────────────────────────────────────────────────── */
function ATSScoreRing({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = 70;
  const stroke = 10;
  const nr = radius - stroke / 2;
  const circumference = nr * 2 * Math.PI;
  const color = score >= 75 ? "#84cc16" : score >= 50 ? "#f59e0b" : "#ef4444";

  useEffect(() => {
    let start = 0;
    const step = 16;
    const increment = score / (1200 / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= score) { setDisplayScore(score); clearInterval(timer); }
      else setDisplayScore(Math.round(start));
    }, step);
    return () => clearInterval(timer);
  }, [score]);

  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={radius * 2} height={radius * 2} className="-rotate-90">
        <circle cx={radius} cy={radius} r={nr} fill="transparent" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <motion.circle
          cx={radius} cy={radius} r={nr} fill="transparent" stroke={color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-5xl font-black tabular-nums leading-none" style={{ color }}>{displayScore}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">ATS Score</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   AI Thinking Loader
───────────────────────────────────────────────────────── */
function AiThinkingLoader({ label }: { label?: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label ?? "AI is thinking…"}</p>
        <div className="flex items-center gap-1.5 px-4 py-3 bg-secondary rounded-2xl rounded-tl-sm w-fit">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Upgrade Modal (subscription)
───────────────────────────────────────────────────────── */
function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-primary/10"><Zap className="h-5 w-5 text-primary" /></div>
            <DialogTitle className="text-xl">Upgrade to Pro</DialogTitle>
          </div>
          <DialogDescription>Unlock unlimited scans and premium features.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 text-center">
            <div className="text-3xl font-black text-primary">$9.99</div>
            <div className="text-sm text-muted-foreground">per month — cancel anytime</div>
          </div>
          {["Unlimited resume scans/day","Priority AI processing","Advanced ATS keyword matching","Unlimited mock interviews"].map((f,i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span>{f}</span>
            </div>
          ))}
          <Button className="w-full" size="lg"><Sparkles className="mr-2 h-4 w-4" /> Start Free 7-Day Trial</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────
   Usage Banner
───────────────────────────────────────────────────────── */
function UsageBanner({ used, limit, onUpgrade }: { used: number; limit: number; onUpgrade: () => void }) {
  const remaining = limit - used;
  const exhausted = remaining <= 0;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${exhausted ? "border-destructive/40 bg-destructive/5" : remaining === 1 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/30"}`}>
      <div className="flex items-center gap-2">
        {exhausted ? <Lock className="h-4 w-4 text-destructive shrink-0" /> : <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className={exhausted ? "text-destructive font-medium" : "text-muted-foreground"}>
          {exhausted ? "Daily limit reached — upgrade for unlimited scans" : `${remaining} free scan${remaining !== 1 ? "s" : ""} remaining today (${used}/${limit} used)`}
        </span>
      </div>
      <Button size="sm" variant={exhausted ? "default" : "outline"} onClick={onUpgrade} className="shrink-0">
        <Zap className="mr-1.5 h-3.5 w-3.5" /> Upgrade
      </Button>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   File Upload Zone
───────────────────────────────────────────────────────── */
function FileUploadZone({ onFileParsed, disabled }: { onFileParsed: (r: ParsedFile) => void; disabled?: boolean }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseFile = useCallback(async (file: File) => {
    const allowed = ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|doc)$/i)) {
      setParseError("Please upload a PDF (.pdf) or Word document (.docx, .doc).");
      return;
    }
    setParseError(null);
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${getApiBase()}/resume/parse-file`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Failed to parse file.");
      }
      const data = await res.json() as ParsedFile;
      onFileParsed(data);
      toast({ title: `Parsed "${data.fileName}"`, description: `${data.wordCount} words extracted.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse file.";
      setParseError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setIsParsing(false);
    }
  }, [onFileParsed, toast]);

  return (
    <div className="space-y-2">
      <motion.div animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer
          ${isDragging ? "border-primary bg-primary/8" : "border-border hover:border-primary/50 hover:bg-muted/30"}
          ${disabled || isParsing ? "opacity-60 cursor-not-allowed" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (!disabled && !isParsing) { const f = e.dataTransfer.files[0]; if (f) parseFile(f); } }}
        onClick={() => !disabled && !isParsing && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }}
          disabled={disabled || isParsing} />
        <div className={`p-4 rounded-full ${isDragging ? "bg-primary/15" : "bg-muted"}`}>
          {isParsing ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />}
        </div>
        <div>
          <p className="text-base font-semibold">{isParsing ? "Extracting text…" : isDragging ? "Drop your file here" : "Upload your resume"}</p>
          <p className="text-sm text-muted-foreground mt-1">{isParsing ? "This takes just a second" : "Drag & drop or click to browse • PDF, DOCX, DOC — up to 10 MB"}</p>
        </div>
        {!isParsing && (
          <div className="flex gap-2">
            <Badge variant="secondary" className="gap-1.5"><FileType className="h-3 w-3" /> PDF</Badge>
            <Badge variant="secondary" className="gap-1.5"><FileText className="h-3 w-3" /> DOCX</Badge>
            <Badge variant="secondary" className="gap-1.5"><FileText className="h-3 w-3" /> DOC</Badge>
          </div>
        )}
      </motion.div>
      {parseError && <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /><span>{parseError}</span></div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Parsed File Card
───────────────────────────────────────────────────────── */
function ParsedFileCard({ parsed, onClear, showPreview, onTogglePreview }: {
  parsed: ParsedFile; onClear: () => void; showPreview: boolean; onTogglePreview: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/15 shrink-0"><FileText className="h-5 w-5 text-primary" /></div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{parsed.fileName}</p>
            <p className="text-xs text-muted-foreground">{parsed.wordCount.toLocaleString()} words extracted</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTogglePreview}>
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Textarea value={parsed.text} readOnly className="min-h-[160px] max-h-[260px] font-mono text-xs resize-none bg-background/50" />
            <p className="text-xs text-muted-foreground mt-1">Read-only preview of extracted text</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Improved Resume Card — shown after successful rewrite
───────────────────────────────────────────────────────── */
function ImprovedResumeCard({ text, originalFileName }: { text: string; originalFileName: string }) {
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = originalFileName.replace(/\.[^.]+$/, "");
    a.href = url;
    a.download = `${base}_improved.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
    >
      <Card className="border-2 border-primary shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Your Improved Resume</CardTitle>
                <CardDescription>AI-optimized with all suggestions applied</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1.5 h-4 w-4" /> Copy
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" /> Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={text}
            readOnly
            className="min-h-[520px] font-mono text-sm resize-y bg-muted/30 leading-relaxed"
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────
   Auto-Fix Button with Razorpay payment flow
───────────────────────────────────────────────────────── */
function AutoFixButton({
  parsed,
  result,
  jobTitle,
  onImproved,
}: {
  parsed: ParsedFile | null;
  result: AnalysisResult;
  jobTitle: string;
  onImproved: (text: string) => void;
}) {
  const [autoFixState, setAutoFixState] = useState<AutoFixState>("idle");
  const { toast } = useToast();

  const handleAutoFix = async () => {
    if (!parsed) return;

    setAutoFixState("paying");

    // Load Razorpay checkout script
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast({ title: "Payment failed", description: "Could not load payment gateway. Check your internet connection.", variant: "destructive" });
      setAutoFixState("idle");
      return;
    }

    // Create order on backend
    let orderData: { orderId: string; amount: number; currency: string; keyId: string };
    try {
      const res = await fetch(`${getApiBase()}/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: 9900, currency: "INR" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Order creation failed.");
      }
      orderData = await res.json();
    } catch (err) {
      toast({ title: "Payment error", description: err instanceof Error ? err.message : "Could not create order.", variant: "destructive" });
      setAutoFixState("idle");
      return;
    }

    // Open Razorpay checkout
    const rzp = new window.Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "HireBoost AI",
      description: "Resume Auto-Fix — AI rewrite with all improvements applied",
      order_id: orderData.orderId,
      theme: { color: "#84cc16" },
      modal: {
        ondismiss: () => {
          setAutoFixState("idle");
          toast({ title: "Payment cancelled" });
        },
      },
      handler: async (response) => {
        setAutoFixState("rewriting");

        // Verify payment
        try {
          const verifyRes = await fetch(`${getApiBase()}/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });
          if (!verifyRes.ok) throw new Error("Payment verification failed.");
          const { paymentId } = await verifyRes.json() as { success: boolean; paymentId: string };

          // Call rewrite API
          const rewriteRes = await fetch(`${getApiBase()}/resume/rewrite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              resumeText: parsed.text,
              atsScore: result.atsScore,
              missingKeywords: result.missingKeywords,
              suggestions: result.suggestions,
              strengths: result.strengths,
              overallFeedback: result.overallFeedback,
              jobTitle: jobTitle || undefined,
              paymentId,
            }),
          });
          if (!rewriteRes.ok) {
            const d = await rewriteRes.json().catch(() => ({}));
            throw new Error((d as { error?: string }).error ?? "Rewrite failed.");
          }
          const { improvedResume } = await rewriteRes.json() as { improvedResume: string };
          setAutoFixState("done");
          onImproved(improvedResume);
          toast({ title: "Resume rewritten!", description: "Your optimized resume is ready to download." });
        } catch (err) {
          toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
          setAutoFixState("idle");
        }
      },
    });

    rzp.open();
  };

  if (autoFixState === "rewriting") {
    return (
      <div className="mt-4">
        <AiThinkingLoader label="AI is rewriting your resume with all improvements…" />
      </div>
    );
  }

  return (
    <Button
      size="lg"
      className="w-full bg-gradient-to-r from-primary to-lime-500 text-primary-foreground font-bold shadow-lg hover:opacity-90"
      onClick={handleAutoFix}
      disabled={autoFixState !== "idle" || !parsed}
    >
      {autoFixState === "paying" ? (
        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening payment…</>
      ) : (
        <>
          <Wand2 className="mr-2 h-5 w-5" />
          Auto-Fix My Resume
          <span className="ml-2 flex items-center text-sm font-semibold opacity-90">
            <IndianRupee className="h-3.5 w-3.5" />99
          </span>
        </>
      )}
    </Button>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────── */
export default function ResumeAnalyzer() {
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [improvedResume, setImprovedResume] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usageData } = useGetResumeDailyUsage();
  const analyzeMutation = useAnalyzeResume();

  const isAnalyzing = analyzeMutation.isPending;
  const isLimitReached = usageData ? usageData.used >= usageData.limit : false;

  const handleAnalyze = () => {
    if (!parsed?.text.trim()) {
      toast({ title: "No file", description: "Please upload your resume first.", variant: "destructive" });
      return;
    }
    if (isLimitReached) { setShowUpgrade(true); return; }

    analyzeMutation.mutate(
      { data: { resumeText: parsed.text, jobTitle: jobTitle || undefined, jobDescription: jobDescription || undefined } },
      {
        onSuccess: (data) => {
          setResult({ atsScore: data.atsScore, missingKeywords: data.missingKeywords, suggestions: data.suggestions, strengths: data.strengths, overallFeedback: data.overallFeedback });
          queryClient.invalidateQueries({ queryKey: getGetResumeDailyUsageQueryKey() });
          toast({ title: "Analysis complete!" });
        },
        onError: (err: { status?: number }) => {
          if (err.status === 429) { setShowUpgrade(true); toast({ title: "Daily limit reached", variant: "destructive" }); }
          else toast({ title: "Analysis failed", description: "Please try again.", variant: "destructive" });
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
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 22 } },
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resume Analyzer</h1>
        <p className="text-muted-foreground mt-1">Upload your resume and get an instant ATS score with tailored AI feedback.</p>
      </div>

      {usageData && <UsageBanner used={usageData.used} limit={usageData.limit} onUpgrade={() => setShowUpgrade(true)} />}

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Upload card */}
              <Card className="lg:col-span-2 border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Upload Resume</CardTitle>
                  <CardDescription>Supports PDF, DOCX, and DOC files up to 10 MB.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!parsed ? (
                    <FileUploadZone onFileParsed={setParsed} disabled={isAnalyzing || isLimitReached} />
                  ) : (
                    <ParsedFileCard parsed={parsed} onClear={() => { setParsed(null); setShowPreview(false); }} showPreview={showPreview} onTogglePreview={() => setShowPreview(v => !v)} />
                  )}
                  <AnimatePresence>
                    {isAnalyzing && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-2">
                        <AiThinkingLoader label="AI is analyzing your resume…" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Target role + analyze */}
              <div className="space-y-4">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Target Role</CardTitle>
                    <CardDescription>Optional — improves keyword matching.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Job Title</Label>
                      <RoleCombobox
                        value={jobTitle}
                        onChange={setJobTitle}
                        placeholder="Select or search a role…"
                        disabled={isAnalyzing}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="jobDescription">Job Description</Label>
                      <Textarea id="jobDescription" placeholder="Paste the job description…" className="min-h-[120px] text-sm resize-y" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} disabled={isAnalyzing} />
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button className="w-full" size="lg" onClick={handleAnalyze} disabled={isAnalyzing || !parsed || isLimitReached}>
                      {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</> : isLimitReached ? <><Lock className="mr-2 h-4 w-4" /> Limit Reached</> : <><LayoutTemplate className="mr-2 h-4 w-4" /> Analyze Resume</>}
                    </Button>
                    {isLimitReached && <Button variant="outline" className="w-full" onClick={() => setShowUpgrade(true)}><Zap className="mr-2 h-4 w-4 text-primary" /> Upgrade to Pro</Button>}
                  </CardFooter>
                </Card>

                <Card className="border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setShowUpgrade(true)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-primary/20"><Zap className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="text-sm font-semibold">Upgrade to Pro</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Unlimited scans, faster AI & more tools.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Results */
          <motion.div key="results" variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => { setResult(null); setParsed(null); setShowPreview(false); setImprovedResume(null); }}>
                Analyze Another
              </Button>
              <Link href="/history"><Button variant="ghost" size="sm">View History <ChevronRight className="ml-1 h-4 w-4" /></Button></Link>
            </div>

            {/* Score + feedback */}
            <div className="grid md:grid-cols-3 gap-5">
              <motion.div variants={itemVariants}>
                <Card className="h-full flex flex-col items-center justify-center border-border/50 shadow-sm py-6">
                  <div className="relative flex items-center justify-center">
                    <ATSScoreRing score={result.atsScore} />
                  </div>
                  <Badge className="mt-4" variant={result.atsScore >= 75 ? "default" : result.atsScore >= 50 ? "secondary" : "destructive"}>
                    {result.atsScore >= 75 ? "Strong Match" : result.atsScore >= 50 ? "Needs Work" : "Low Match"}
                  </Badge>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants} className="md:col-span-2">
                <Card className="h-full border-border/50 shadow-sm">
                  <CardHeader><CardTitle>Overall Feedback</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{result.overallFeedback}</p>
                    {parsed && <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{parsed.fileName} — {parsed.wordCount.toLocaleString()} words</p>}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Missing keywords + strengths */}
            <div className="grid md:grid-cols-2 gap-5">
              <motion.div variants={itemVariants}>
                <Card className="h-full border-border/50 shadow-sm border-t-4 border-t-destructive/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><AlertCircle className="h-4 w-4 text-destructive" /> Missing Keywords</CardTitle>
                    <CardDescription>Add these to boost your ATS score.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.missingKeywords.map((kw, i) => (
                        <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-2 text-sm">
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
                    <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-primary" /> Key Strengths</CardTitle>
                    <CardDescription>What your resume does well.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.strengths.map((s, i) => (
                        <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-2 text-sm">
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
                      <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-3 bg-muted/50 p-3 rounded-lg text-sm">
                        <span className="font-bold text-blue-500 shrink-0">{i + 1}.</span>
                        <span>{sug}</span>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Auto-Fix CTA ── */}
            {!improvedResume && (
              <motion.div variants={itemVariants}>
                <Card className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-lime-500/5 shadow-md">
                  <CardContent className="pt-6 pb-6 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/15 shrink-0">
                        <Wand2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Auto-Fix My Resume</h3>
                        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                          Let AI automatically rewrite your entire resume — applying all the suggestions above, 
                          adding missing keywords, strengthening your bullet points, and making it 
                          ATS-optimized. Get a download-ready improved resume instantly.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {["All suggestions applied","Missing keywords added","Stronger action verbs","ATS-optimized format"].map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <AutoFixButton parsed={parsed} result={result} jobTitle={jobTitle} onImproved={setImprovedResume} />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Improved resume output ── */}
            {improvedResume && (
              <ImprovedResumeCard text={improvedResume} originalFileName={parsed?.fileName ?? "resume"} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
