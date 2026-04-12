import { useGetResumeHistory, useListInterviewSessions } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Video, ChevronRight, Star, Target, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function History() {
  const { data: resumes, isLoading: resumesLoading } = useGetResumeHistory();
  const { data: interviews, isLoading: interviewsLoading } = useListInterviewSessions();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-1">Review your past performance and track improvement.</p>
      </div>

      <Tabs defaultValue="interviews" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8">
          <TabsTrigger value="interviews">Mock Interviews</TabsTrigger>
          <TabsTrigger value="resumes">Resume Analyses</TabsTrigger>
        </TabsList>

        <TabsContent value="interviews" className="space-y-4">
          {interviewsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : interviews && interviews.length > 0 ? (
            interviews.map((session, idx) => (
              <motion.div 
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="hover:border-primary/50 transition-colors overflow-hidden group">
                  <div className="flex flex-col md:flex-row md:items-center">
                    <div className="p-6 flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Video className="h-4 w-4" />
                        {format(new Date(session.createdAt), "MMM do, yyyy • h:mm a")}
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-xs uppercase tracking-wider font-semibold">
                          {session.difficulty}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold mb-1">{session.jobRole}</h3>
                      <div className="text-sm text-muted-foreground">
                        {session.status === "completed" ? "Completed" : "In Progress"} • {session.answeredQuestions}/{session.totalQuestions} Questions Answered
                      </div>
                    </div>
                    <div className="bg-secondary/50 p-6 md:w-48 flex md:flex-col items-center justify-between md:justify-center border-t md:border-t-0 md:border-l">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Rating</div>
                        <div className="text-2xl font-bold flex items-center justify-center gap-1">
                          {session.averageRating ? session.averageRating.toFixed(1) : "-"}
                          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mb-0.5" />
                        </div>
                      </div>
                      <Link href={`/interview/${session.id}`}>
                        <Button variant="ghost" size="sm" className="mt-0 md:mt-4 group-hover:bg-primary group-hover:text-primary-foreground">
                          {session.status === "completed" ? "Review" : "Continue"} <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Video className="h-12 w-12 text-muted mb-4" />
                <h3 className="text-lg font-medium">No interviews yet</h3>
                <p className="text-muted-foreground mt-1 mb-6">Start a mock interview to see your history here.</p>
                <Link href="/interview">
                  <Button>New Interview</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resumes" className="space-y-4">
          {resumesLoading ? (
             <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : resumes && resumes.length > 0 ? (
            resumes.map((resume, idx) => (
              <motion.div 
                key={resume.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="hover:border-primary/50 transition-colors overflow-hidden group">
                  <div className="flex flex-col md:flex-row md:items-center">
                    <div className="p-6 flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <FileText className="h-4 w-4" />
                        {format(new Date(resume.createdAt), "MMM do, yyyy • h:mm a")}
                      </div>
                      <h3 className="text-xl font-bold mb-1">{resume.jobTitle || "General Analysis"}</h3>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        Analyzed resume against ATS scoring criteria.
                      </div>
                    </div>
                    <div className="bg-primary/5 p-6 md:w-48 flex md:flex-col items-center justify-between md:justify-center border-t md:border-t-0 md:border-l border-primary/10">
                      <div className="text-center">
                        <div className="text-xs text-primary font-medium uppercase tracking-wider mb-1">ATS Score</div>
                        <div className="text-3xl font-extrabold text-primary flex items-center justify-center gap-1">
                          {resume.atsScore}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted mb-4" />
                <h3 className="text-lg font-medium">No resumes analyzed</h3>
                <p className="text-muted-foreground mt-1 mb-6">Analyze your resume to see your history here.</p>
                <Link href="/resume">
                  <Button>Analyze Resume</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
