import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  TrendingUp,
  Copy,
  CheckCheck,
  DollarSign,
  MessageSquare,
  Mail,
  BarChart3,
  Lightbulb,
  IndianRupee,
} from "lucide-react";

interface SalaryResult {
  counterOfferScript: string;
  hrMessage: string;
  marketInsight: string;
  suggestedCounter: number;
  negotiationTips: string[];
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs shrink-0">
      {copied ? (
        <><CheckCheck className="h-3.5 w-3.5 mr-1 text-green-500" /> Copied!</>
      ) : (
        <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
      )}
    </Button>
  );
}

export default function SalaryNegotiation() {
  const { toast } = useToast();

  const [form, setForm] = useState({
    role: "",
    experience: "",
    currentSalary: "",
    offeredSalary: "",
    targetSalary: "",
    location: "",
    skills: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SalaryResult | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = () => {
    if (!form.role.trim()) return "Please enter the job role";
    if (!form.experience || isNaN(Number(form.experience))) return "Please enter years of experience";
    if (!form.currentSalary || isNaN(Number(form.currentSalary))) return "Please enter your current salary";
    if (!form.offeredSalary || isNaN(Number(form.offeredSalary))) return "Please enter the offered salary";
    return null;
  };

  const generate = async () => {
    const err = validate();
    if (err) { toast({ title: err, variant: "destructive" }); return; }

    setLoading(true);
    setResult(null);
    try {
      const body = {
        role: form.role.trim(),
        experience: Number(form.experience),
        currentSalary: Number(form.currentSalary) * (form.currentSalary.length < 6 ? 100000 : 1),
        offeredSalary: Number(form.offeredSalary) * (form.offeredSalary.length < 6 ? 100000 : 1),
        ...(form.targetSalary ? { targetSalary: Number(form.targetSalary) * (form.targetSalary.length < 6 ? 100000 : 1) } : {}),
        ...(form.location ? { location: form.location.trim() } : {}),
        ...(form.skills ? { skills: form.skills.trim() } : {}),
      };

      const res = await fetch(`${BASE}/api/salary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as SalaryResult;
      setResult(data);
    } catch {
      toast({ title: "Failed to generate scripts", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-green-500" />
          Salary Negotiation Tool
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-generated counter-offer scripts, HR messages, and market insights tailored to your offer.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Input Form */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-green-500" /> Your Offer Details
              </CardTitle>
              <CardDescription>Enter your details to get personalised negotiation scripts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Job Role *</Label>
                <Input id="role" placeholder="e.g. Senior Software Engineer" value={form.role} onChange={set("role")} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exp">Experience (years) *</Label>
                  <Input id="exp" type="number" min={0} max={50} placeholder="e.g. 4" value={form.experience} onChange={set("experience")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="e.g. Bangalore" value={form.location} onChange={set("location")} />
                </div>
              </div>

              <div className="rounded-lg bg-secondary/40 p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary Figures (₹ LPA)</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="current">Current CTC (₹ LPA) *</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="current" className="pl-8" type="number" placeholder="e.g. 8" value={form.currentSalary} onChange={set("currentSalary")} />
                    </div>
                    <p className="text-xs text-muted-foreground">Enter in Lakhs (e.g. 8 for ₹8 LPA)</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="offered">Offered CTC (₹ LPA) *</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="offered" className="pl-8" type="number" placeholder="e.g. 12" value={form.offeredSalary} onChange={set("offeredSalary")} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="target">Your Target CTC (₹ LPA) <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="target" className="pl-8" type="number" placeholder="e.g. 15" value={form.targetSalary} onChange={set("targetSalary")} />
                    </div>
                    <p className="text-xs text-muted-foreground">Leave blank for AI to suggest the optimal counter</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Key Skills <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="skills"
                  placeholder="e.g. React, Node.js, AWS, 2 years team lead experience..."
                  value={form.skills}
                  onChange={set("skills")}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <Button
                className="w-full h-12 text-base font-bold shadow-lg shadow-green-500/20"
                onClick={generate}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating Scripts…</>
                ) : (
                  <><TrendingUp className="mr-2 h-5 w-5" /> Generate Negotiation Scripts</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Output Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-4">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="bg-secondary/30 border-dashed border-2 min-h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-3 p-8">
                    <TrendingUp className="h-12 w-12 text-green-500/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">Your negotiation scripts will appear here</p>
                    <p className="text-xs text-muted-foreground">Fill in your offer details and click Generate</p>
                  </div>
                </Card>
              </motion.div>
            )}

            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-border/50 min-h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto h-16 w-16">
                      <Loader2 className="h-16 w-16 animate-spin text-green-500/20" />
                      <DollarSign className="absolute inset-0 m-auto h-8 w-8 text-green-500 animate-pulse" />
                    </div>
                    <div>
                      <p className="font-medium">AI is crafting your scripts…</p>
                      <p className="text-sm text-muted-foreground mt-1">Analysing market data and your profile</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Suggested Counter */}
                <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20 shadow-sm">
                  <CardContent className="pt-4 pb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">AI Suggested Counter Offer</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                        {formatInr(result.suggestedCounter)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">per annum</p>
                    </div>
                    <BarChart3 className="h-12 w-12 text-green-500/40" />
                  </CardContent>
                </Card>

                {/* Market Insight */}
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market Insight</span>
                    </div>
                    <p className="text-sm leading-relaxed">{result.marketInsight}</p>
                  </CardContent>
                </Card>

                {/* Counter Offer Script */}
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verbal Script (Call / In-Person)</span>
                      </div>
                      <CopyButton text={result.counterOfferScript} label="Verbal Script" />
                    </div>
                    <div className="rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 p-3">
                      <p className="text-sm leading-relaxed italic">{result.counterOfferScript}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* HR Email */}
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HR Email / Message</span>
                      </div>
                      <CopyButton text={result.hrMessage} label="HR Email" />
                    </div>
                    <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 p-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.hrMessage}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Tips */}
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pro Negotiation Tips</span>
                    </div>
                    <ul className="space-y-2">
                      {result.negotiationTips.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold">
                            {i + 1}
                          </span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
