import { Link } from "wouter";
import { useGetDashboardStats, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Video, Trophy, TrendingUp, Target, Plus, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your career prep progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/resume">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Analyze Resume
            </Button>
          </Link>
          <Link href="/interview">
            <Button className="gap-2">
              <Video className="h-4 w-4" />
              New Interview
            </Button>
          </Link>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Latest ATS Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.latestResumeScore ? `${stats.latestResumeScore}` : "-"}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Out of 100
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resumes Analyzed</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalResumesAnalyzed || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total parsed & scored
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mock Interviews</CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.completedInterviews || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Sessions completed
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Interview Rating</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.averageInterviewRating ? stats.averageInterviewRating.toFixed(1) : "-"}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Out of 5.0
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions and results</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-6">
                {activity.map((item, idx) => (
                  <motion.div 
                    key={item.id} 
                    initial={{ opacity: 0, x: -20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="mt-0.5 bg-primary/10 p-2 rounded-full text-primary">
                      {item.type === "resume_analysis" ? <FileText className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.subtitle} • {format(new Date(item.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.score !== undefined && item.score !== null && (
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                          {item.score} ATS
                        </div>
                      )}
                      {item.rating !== undefined && item.rating !== null && (
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-accent border-border">
                          {item.rating}/5
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="bg-muted p-4 rounded-full mb-4">
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No activity yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
                  Analyze your resume or complete a mock interview to see your progress here.
                </p>
                <div className="flex gap-4">
                  <Link href="/resume">
                    <Button variant="outline" size="sm">Analyze Resume</Button>
                  </Link>
                  <Link href="/interview">
                    <Button size="sm">Mock Interview</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Top Targeted Roles</CardTitle>
            <CardDescription>Roles you've analyzed or interviewed for</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {!statsLoading && stats?.topJobRoles && stats.topJobRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stats.topJobRoles.map(role => (
                  <div key={role} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm font-medium">
                    {role}
                  </div>
                ))}
              </div>
            ) : !statsLoading ? (
              <div className="text-sm text-muted-foreground flex flex-col items-center justify-center h-full py-8 text-center">
                <Target className="h-8 w-8 mb-2 opacity-20" />
                Provide job titles during analysis to track them.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
