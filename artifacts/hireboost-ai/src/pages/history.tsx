import { useGetResumeHistory, useListInterviewSessions } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Video, ChevronRight, Star, Target, Loader2, CheckCircle2, Clock } from "lucide-react";
import { motion } from "framer-motion";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" :
    score >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800";
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border px-5 py-3 ${color} shrink-0`}>
      <span className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-0.5">ATS</span>
      <span className="text-2xl font-extrabold leading-none">{score}</span>
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/40 px-5 py-3 shrink-0">
      <Star className="h-3 w-3 text-amber-500 fill-amber-500 mb-0.5" />
      <span className="text-2xl font-extrabold leading-none text-amber-700 dark:text-amber-400">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function History() {
  const { data: resumes, isLoading: resumesLoading } = useGetResumeHistory();
  const { data: interviews, isLoading: interviewsLoading } = useListInterviewSessions();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">Review your past performance and track improvement over time.</p>
      </div>

      <Tabs defaultValue="interviews" className="w-full">
        <TabsList className="h-11 mb-8 bg-muted/60 border border-border/40">
          <TabsTrigger value="interviews" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Video className="h-4 w-4" />
            Mock Interviews
          </TabsTrigger>
          <TabsTrigger value="resumes" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />
            Resume Analyses
          </TabsTrigger>
        </TabsList>

        {/* Interviews */}
        <TabsContent value="interviews" className="space-y-3">
          {interviewsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : interviews && interviews.length > 0 ? (
            interviews.map((session, idx) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-border/60 hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    {/* Icon */}
                    <div className="shrink-0 hidden sm:flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      <Video className="h-5 w-5" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-base font-bold truncate">{session.jobRole}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                          session.difficulty === "easy" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          session.difficulty === "hard" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {session.difficulty}
                        </span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${session.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {session.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {session.status === "completed" ? "Completed" : "In Progress"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>{session.createdAt
  ? format(new Date(session.createdAt), "MMM d, yyyy · h:mm a")
  : "Unknown date"}</span>
                        <span>{session.answeredQuestions}/{session.totalQuestions} questions answered</span>
                      </div>
                    </div>
                    {/* Rating */}
                    <div className="shrink-0 flex items-center gap-3">
                      {session.averageRating != null && (
                        <RatingBadge rating={session.averageRating} />
                      )}
                      <Link href={`/interview/${session.id}`}>
                        <Button variant="ghost" size="icon" className="rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <Video className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-bold">No interviews yet</h3>
                <p className="text-muted-foreground mt-1 mb-6 text-sm max-w-xs">
                  Start a mock interview to practice your skills and see feedback here.
                </p>
                <Link href="/interview">
                  <Button className="shadow-md shadow-primary/20">Start Mock Interview</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Resumes */}
        <TabsContent value="resumes" className="space-y-3">
          {resumesLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : resumes && resumes.length > 0 ? (
            resumes.map((resume, idx) => (
              <motion.div
                key={resume.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-border/60 hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    <div className="shrink-0 hidden sm:flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold truncate mb-1">
                        {resume.jobTitle || "General Analysis"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        {resume.createdAt
  ? format(new Date(resume.createdAt), "MMM d, yyyy · h:mm a")
  : "Unknown date"}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {resume.atsScore != null && <ScoreBadge score={resume.atsScore} />}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold">No resumes analyzed</h3>
                <p className="text-muted-foreground mt-1 mb-6 text-sm max-w-xs">
                  Upload or paste your resume to get an instant ATS score and keyword analysis.
                </p>
                <Link href="/resume">
                  <Button className="shadow-md shadow-primary/20">Analyze My Resume</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
