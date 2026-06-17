import { Link } from "wouter";
import { useGetDashboardStats, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, Video, Trophy, TrendingUp, Target,
  Activity, ClipboardList, Star, ArrowRight, Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useAuth } from "@/components/auth-provider";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const quickActions = [
  { href: "/resume", icon: FileText, label: "Analyze Resume", desc: "Score your CV instantly", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60", border: "border-emerald-200 dark:border-emerald-800" },
  { href: "/interview", icon: Video, label: "Mock Interview", desc: "Practice with AI coach", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60", border: "border-blue-200 dark:border-blue-800" },
  { href: "/jd-prep", icon: ClipboardList, label: "JD Prep", desc: "Tailored interview Q&A", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60", border: "border-amber-200 dark:border-amber-800" },
  { href: "/salary", icon: TrendingUp, label: "Salary Tool", desc: "Negotiate a better offer", color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-950/60", border: "border-violet-200 dark:border-violet-800" },
];

interface StatCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  delay: number;
  accent: string;
  accentBg: string;
}

function StatCard({ title, value, sub, icon: Icon, delay, accent, accentBg }: StatCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="relative overflow-hidden border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentBg}`}>
            <Icon className={`h-4 w-4 ${accent}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-extrabold ${accent}`}>{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

const storedName =
  typeof window !== "undefined"
    ? localStorage.getItem("userName")
    : "";

const firstName =
  user?.name?.split(" ")[0] ||
  storedName?.split(" ")[0] ||
  "Friend";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <p className="text-sm text-muted-foreground font-medium">{greeting()},</p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-0.5">{firstName} 👋</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's your career prep overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/resume">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Analyze Resume
            </Button>
          </Link>
          <Link href="/interview">
            <Button className="gap-2 shadow-md shadow-primary/20">
              <Sparkles className="h-4 w-4" />
              New Interview
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-lg" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Latest ATS Score" value={stats?.latestResumeScore ? `${stats.latestResumeScore}` : "—"} sub="Out of 100" icon={Target} delay={0.1} accent="text-emerald-600 dark:text-emerald-400" accentBg="bg-emerald-100 dark:bg-emerald-900/40" />
          <StatCard title="Resumes Analyzed" value={String(stats?.totalResumesAnalyzed || 0)} sub="Total scored" icon={FileText} delay={0.2} accent="text-blue-600 dark:text-blue-400" accentBg="bg-blue-100 dark:bg-blue-900/40" />
          <StatCard title="Interviews Done" value={String(stats?.completedInterviews || 0)} sub="Sessions completed" icon={Video} delay={0.3} accent="text-violet-600 dark:text-violet-400" accentBg="bg-violet-100 dark:bg-violet-900/40" />
          <StatCard title="Avg. Interview Rating" value={stats?.averageInterviewRating ? stats.averageInterviewRating.toFixed(1) : "—"} sub="Out of 5.0" icon={Trophy} delay={0.4} accent="text-amber-600 dark:text-amber-400" accentBg="bg-amber-100 dark:bg-amber-900/40" />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(({ href, icon: Icon, label, desc, color, bg, border }, i) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
            >
              <Link href={href}>
                <div className={`group relative rounded-xl border ${border} ${bg} p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-black/20 shadow-sm border border-white/60 dark:border-white/10 mb-3`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div className="text-sm font-bold">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                  <ArrowRight className="absolute top-4 right-4 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Activity + Roles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 flex flex-col border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest actions and results</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-2/5" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-1">
                {activity.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.07 }}
                    className="flex items-center gap-4 rounded-xl p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${item.type === "resume_analysis" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}>
                      {item.type === "resume_analysis" ? <FileText className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
  {item.subtitle ? `${item.subtitle} · ` : ""}
  {item.createdAt
    ? format(new Date(item.createdAt), "MMM d, h:mm a")
    : "Unknown date"}
</p>
                    </div>
                    <div className="shrink-0">
                      {item.score != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {item.score} ATS
                        </span>
                      )}
                      {item.rating != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-current" /> {item.rating}/5
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Activity className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold">No activity yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-1 mb-6">
                  Analyze a resume or complete a mock interview to see your progress.
                </p>
                <div className="flex gap-3">
                  <Link href="/resume"><Button variant="outline" size="sm">Analyze Resume</Button></Link>
                  <Link href="/interview"><Button size="sm">Mock Interview</Button></Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Targeted Roles
            </CardTitle>
            <CardDescription>Roles you've analysed or interviewed for</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {!statsLoading && stats?.topJobRoles && stats.topJobRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stats.topJobRoles.map((role, index) => (
  <span key={`${role}-${index}`} className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-semibold">
                    {role}
                  </span>
                ))}
              </div>
            ) : !statsLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center text-sm text-muted-foreground gap-3">
                <Target className="h-8 w-8 opacity-20" />
                Add job titles during analysis to track your target roles here.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
