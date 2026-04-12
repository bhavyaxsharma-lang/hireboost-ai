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

const JOB_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "Product Manager",
  "UX/UI Designer",
  "DevOps Engineer",
  "QA Engineer",
  "AI/ML Engineer",
  "RPA Developer"
];

export default function InterviewHub() {
  const [jobRole, setJobRole] = useState(JOB_ROLES[0]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState("5");
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const createSession = useCreateInterviewSession();

  const handleStart = () => {
    createSession.mutate(
      {
        data: {
          jobRole,
          difficulty,
          questionCount: parseInt(questionCount, 10)
        }
      },
      {
        onSuccess: (session) => {
          setLocation(`/interview/${session.id}`);
        },
        onError: (err) => {
          toast({
            title: "Failed to start interview",
            description: err.error || "Please try again later.",
            variant: "destructive"
          });
        }
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
              <div className="space-y-3">
                <Label htmlFor="role">Target Role</Label>
                <Select value={jobRole} onValueChange={setJobRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_ROLES.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Difficulty Level</Label>
                <RadioGroup 
                  value={difficulty} 
                  onValueChange={(val: any) => setDifficulty(val)}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent cursor-pointer transition-colors">
                    <RadioGroupItem value="easy" id="r-easy" />
                    <Label htmlFor="r-easy" className="flex-1 cursor-pointer font-medium">Easy — Fundamentals & Basics</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent cursor-pointer transition-colors">
                    <RadioGroupItem value="medium" id="r-medium" />
                    <Label htmlFor="r-medium" className="flex-1 cursor-pointer font-medium">Medium — Practical & Scenarios</Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-accent cursor-pointer transition-colors">
                    <RadioGroupItem value="hard" id="r-hard" />
                    <Label htmlFor="r-hard" className="flex-1 cursor-pointer font-medium">Hard — System Design & Edge Cases</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label htmlFor="qcount">Number of Questions</Label>
                <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger id="qcount">
                    <SelectValue placeholder="Select count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Questions (Short)</SelectItem>
                    <SelectItem value="7">7 Questions (Standard)</SelectItem>
                    <SelectItem value="10">10 Questions (Comprehensive)</SelectItem>
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
                {createSession.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing AI...</>
                ) : (
                  <><PlayCircle className="mr-2 h-5 w-5" /> Start Interview</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
          <Card className="bg-secondary/30 border-none shadow-none">
            <CardHeader>
              <CardTitle className="text-xl">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">1</div>
                <div>
                  <h4 className="font-semibold">Setup</h4>
                  <p className="text-sm text-muted-foreground mt-1">Configure your role and difficulty. The AI will generate highly specific questions for that exact profile.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">2</div>
                <div>
                  <h4 className="font-semibold">Answer</h4>
                  <p className="text-sm text-muted-foreground mt-1">Type your answer to each question. Treat it like a real interview scenario.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">3</div>
                <div>
                  <h4 className="font-semibold">Get Feedback</h4>
                  <p className="text-sm text-muted-foreground mt-1">After each answer, receive an instant rating (1-5 stars) and detailed critique on what you missed or did well.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="rounded-xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-primary/20 mix-blend-overlay z-10" />
            <img 
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop" 
              alt="Professional setting" 
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
