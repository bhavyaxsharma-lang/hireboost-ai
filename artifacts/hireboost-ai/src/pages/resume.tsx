import { useState } from "react";
import { Link } from "wouter";
import { useUploadResume, useAnalyzeResume } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { FileText, Loader2, Upload, AlertCircle, CheckCircle2, ChevronRight, Target, LayoutTemplate } from "lucide-react";

export default function ResumeAnalyzer() {
  const [resumeText, setResumeText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  
  const { toast } = useToast();
  
  const uploadMutation = useUploadResume();
  const analyzeMutation = useAnalyzeResume();

  const [result, setResult] = useState<any | null>(null);
  const [scoreProgress, setScoreProgress] = useState(0);

  const isAnalyzing = analyzeMutation.isPending;

  const handleAnalyze = () => {
    if (!resumeText.trim()) {
      toast({
        title: "Missing Information",
        description: "Please paste your resume text.",
        variant: "destructive"
      });
      return;
    }

    analyzeMutation.mutate(
      { data: { resumeText, jobTitle: jobTitle || undefined, jobDescription: jobDescription || undefined } },
      {
        onSuccess: (data) => {
          setResult(data);
          // Animate score progress
          setScoreProgress(0);
          setTimeout(() => setScoreProgress(data.atsScore), 300);
          toast({ title: "Analysis Complete!" });
        },
        onError: (error) => {
          toast({
            title: "Analysis Failed",
            description: "Could not complete the analysis. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleReset = () => {
    setResult(null);
    setScoreProgress(0);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resume Analyzer</h1>
        <p className="text-muted-foreground mt-1">Get an instant ATS score and tailored improvements.</p>
      </div>

      {!result ? (
        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-border/50 shadow-md">
            <CardHeader>
              <CardTitle>Resume Content</CardTitle>
              <CardDescription>Paste your resume text here to begin.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Paste your full resume text here..." 
                className="min-h-[400px] font-mono text-sm resize-y"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                disabled={isAnalyzing}
              />
            </CardContent>
          </Card>
          
          <div className="space-y-6">
            <Card className="border-border/50 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" /> Target Role
                </CardTitle>
                <CardDescription>Optional but recommended for better keyword matching.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input 
                    id="jobTitle" 
                    placeholder="e.g. Senior Frontend Engineer" 
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    disabled={isAnalyzing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobDescription">Job Description</Label>
                  <Textarea 
                    id="jobDescription" 
                    placeholder="Paste the job description here..." 
                    className="min-h-[150px] text-sm resize-y"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    disabled={isAnalyzing}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing || !resumeText.trim()}
                >
                  {isAnalyzing ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</>
                  ) : (
                    <><LayoutTemplate className="mr-2 h-5 w-5" /> Analyze Resume</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset}>
              Analyze Another
            </Button>
            <Link href={`/history`}>
              <Button variant="ghost">View History <ChevronRight className="ml-1 h-4 w-4" /></Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="h-full flex flex-col justify-center border-border/50 shadow-md overflow-hidden relative">
                <div className="absolute inset-0 bg-primary/5 z-0" />
                <CardHeader className="relative z-10 pb-2">
                  <CardTitle className="text-center text-lg text-muted-foreground">Overall ATS Score</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 flex flex-col items-center justify-center flex-1 py-8">
                  <div className="text-7xl font-extrabold tracking-tighter text-primary drop-shadow-sm mb-6">
                    {scoreProgress}
                  </div>
                  <div className="w-full max-w-[200px] h-3 bg-secondary rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${scoreProgress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card className="h-full border-border/50 shadow-md">
                <CardHeader>
                  <CardTitle>Overall Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {result.overallFeedback}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="h-full border-border/50 shadow-md border-t-4 border-t-destructive/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" /> Missing Keywords
                  </CardTitle>
                  <CardDescription>Add these to improve your ATS match rate.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.missingKeywords.length > 0 ? (
                      result.missingKeywords.map((kw: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                          <span className="font-medium">{kw}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">Great job! No major keywords missing.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="h-full border-border/50 shadow-md border-t-4 border-t-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" /> Key Strengths
                  </CardTitle>
                  <CardDescription>What you are doing right.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.strengths.length > 0 ? (
                      result.strengths.map((str: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          <span>{str}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">Needs significant improvement.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card className="border-border/50 shadow-md border-t-4 border-t-blue-500">
                <CardHeader>
                  <CardTitle>Actionable Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {result.suggestions.map((sug: string, i: number) => (
                      <li key={i} className="flex gap-3 bg-secondary/50 p-3 rounded-lg text-sm">
                        <span className="font-bold text-blue-500 shrink-0">{i + 1}.</span>
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
