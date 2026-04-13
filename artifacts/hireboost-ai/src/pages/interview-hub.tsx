import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateInterviewSession } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { motion } from "framer-motion";
import { Loader2, PlayCircle, Trophy, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RoleCombobox, ALL_ROLES, ROLE_GROUPS } from "@/components/role-combobox";

/* ─────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────── */
export default function InterviewHub() {
  const [jobRole, setJobRole] = useState(ALL_ROLES[0]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState("5");

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createSession = useCreateInterviewSession();

  const handleStart = () => {
    createSession.mutate(
      { data: { jobRole, difficulty, questionCount: parseInt(questionCount, 10) } },
      {
        onSuccess: (session) => setLocation(`/interview/${session.id}`),
        onError: (err) => toast({
          title: "Failed to start interview",
          description: (err as { error?: string }).error ?? "Please try again later.",
          variant: "destructive",
        }),
      }
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mock Interview Hub</h1>
        <p className="text-muted-foreground mt-1">Configure your AI mock interview session.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" /> Session Setup
              </CardTitle>
              <CardDescription>Tailor the AI to your specific target role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Searchable role combobox */}
              <div className="space-y-2">
                <Label>Target Role</Label>
                <RoleCombobox value={jobRole} onChange={setJobRole} />
                <p className="text-xs text-muted-foreground">
                  {ROLE_GROUPS.length} categories · {ALL_ROLES.length}+ roles — search by name or industry
                </p>
              </div>

              {/* Difficulty */}
              <div className="space-y-3">
                <Label>Difficulty Level</Label>
                <RadioGroup
                  value={difficulty}
                  onValueChange={(val) => setDifficulty(val as "easy" | "medium" | "hard")}
                  className="flex flex-col space-y-1"
                >
                  {[
                    { value: "easy", label: "Easy", sub: "Fundamentals & Basics" },
                    { value: "medium", label: "Medium", sub: "Practical & Scenarios" },
                    { value: "hard", label: "Hard", sub: "System Design & Edge Cases" },
                  ].map(({ value: v, label, sub }) => (
                    <div key={v} className={`flex items-center space-x-3 border rounded-md p-3 cursor-pointer transition-colors ${difficulty === v ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                      <RadioGroupItem value={v} id={`r-${v}`} />
                      <Label htmlFor={`r-${v}`} className="flex-1 cursor-pointer">
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground font-normal"> — {sub}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Question count */}
              <div className="space-y-2">
                <Label htmlFor="qcount">Number of Questions</Label>
                <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger id="qcount">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Questions — Quick (≈10 min)</SelectItem>
                    <SelectItem value="7">7 Questions — Standard (≈15 min)</SelectItem>
                    <SelectItem value="10">10 Questions — Deep Dive (≈20 min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="pt-2 pb-6">
              <Button
                className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
                onClick={handleStart}
                disabled={createSession.isPending}
              >
                {createSession.isPending
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing AI…</>
                  : <><PlayCircle className="mr-2 h-5 w-5" /> Start Interview</>}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
          <Card className="bg-secondary/30 border-none shadow-none">
            <CardHeader><CardTitle className="text-xl">How it works</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {[
                { n: 1, title: "Setup", body: "Pick your role from 12 industry categories and set the difficulty. The AI generates specific questions for that profile." },
                { n: 2, title: "Answer", body: "Type your answer and press Send (or Ctrl+Enter). Treat it like a real interview — take your time." },
                { n: 3, title: "Get Feedback", body: "After each answer, receive a star rating (1–5) and a detailed critique on what you did well and what to improve." },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex gap-4">
                  <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">{n}</div>
                  <div>
                    <h4 className="font-semibold">{title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="rounded-xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-primary/20 mix-blend-overlay z-10" />
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop"
              alt="Professional interview setting"
              className="w-full h-48 object-cover grayscale transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <Trophy className="h-16 w-16 text-white drop-shadow-md opacity-80" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
