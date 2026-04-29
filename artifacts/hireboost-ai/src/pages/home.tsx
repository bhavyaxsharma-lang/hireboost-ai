import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Video,
  ClipboardList,
  TrendingUp,
  Sparkles,
  Star,
  Zap,
  Shield,
  Clock,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    title: "Resume Analyzer",
    desc: "Get an instant ATS score (0–100), keyword gap analysis, and specific improvements to beat any applicant tracking system.",
    pills: ["ATS Score", "Keyword Analysis", "DOCX Download"],
  },
  {
    icon: Video,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    title: "AI Mock Interviews",
    desc: "Practice role-specific interviews across 100+ job titles. Get star ratings and detailed feedback on every answer.",
    pills: ["100+ Roles", "Real-time Feedback", "Answer Examples"],
  },
  {
    icon: ClipboardList,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    title: "JD Interview Prep",
    desc: "Paste any job description and get tailored interview questions with model answers, so you walk in fully prepared.",
    pills: ["AI Q&A", "Model Answers", "Role-specific"],
  },
  {
    icon: TrendingUp,
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    title: "Salary Negotiation",
    desc: "Input your offer details and get a ready-to-use counter script, HR email, and market salary insights instantly.",
    pills: ["Counter Script", "HR Email", "Market Insight"],
  },
];

const stats = [
  { value: "10K+", label: "Resumes Scored" },
  { value: "5K+", label: "Interviews Practised" },
  { value: "100+", label: "Job Roles Covered" },
  { value: "4.9★", label: "User Rating" },
];

const steps = [
  { n: "01", title: "Sign up for free", body: "Create your account in under 30 seconds — no credit card required." },
  { n: "02", title: "Pick your tool", body: "Use the Resume Analyzer, Mock Interview, JD Interview Prep, or Salary Negotiation tool." },
  { n: "03", title: "Get AI-powered results", body: "Receive detailed, actionable output that directly improves your job search." },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const cta = isAuthenticated ? "/dashboard" : "/auth";

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 md:px-8 pt-16 pb-20 md:pt-24 md:pb-32">
        {/* Background blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-blue-500/8 blur-3xl" />

        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-16">
          {/* Left */}
          <motion.div
            className="flex-1 flex flex-col items-start gap-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Career Platform
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Land your{" "}
              <span className="bg-gradient-to-r from-primary via-lime-400 to-emerald-500 bg-clip-text text-transparent">
                dream job
              </span>{" "}
              faster with AI
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Score your resume, ace AI mock interviews, prep from any job description, and negotiate a better salary — all in one platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <Link href={cta}>
                <Button size="lg" className="h-13 px-8 text-base font-bold shadow-xl shadow-primary/25 hover:scale-[1.03] transition-transform">
                  Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground mt-2">
              {["No credit card required", "Free 2 rewrites included", "Instant results"].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — hero image */}
          <motion.div
            className="flex-1 w-full max-w-[480px] relative"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.15 }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-blue-500/10 rounded-3xl blur-2xl" />
            <div className="relative rounded-3xl border border-border/60 bg-card/60 backdrop-blur shadow-2xl overflow-hidden p-1">
              <img
                src="/hero.png"
                alt="HireBoost AI platform"
                className="w-full rounded-2xl object-contain"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-border/50 bg-muted/30 py-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map(({ value, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="text-3xl font-extrabold text-foreground">{value}</div>
                <div className="text-sm text-muted-foreground mt-1">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-4">
              <Zap className="h-3.5 w-3.5" />
              Everything you need
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Four AI tools. One career platform.
            </h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
              Every tool is purpose-built to give job seekers a real, measurable edge in their search.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, color, bg, border, title, desc, pills }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl border ${border} ${bg} p-7 flex flex-col gap-4 hover:shadow-lg transition-shadow`}
              >
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-black/20 shadow-sm border border-white/60 dark:border-white/10`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  {pills.map((p) => (
                    <span key={p} className="rounded-full bg-white/70 dark:bg-white/10 border border-border/40 px-3 py-1 text-xs font-semibold">
                      {p}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-muted/30 border-y border-border/50 py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary mb-4">
              <Clock className="h-3.5 w-3.5" />
              Quick to get started
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">How it works</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(({ n, title, body }, i) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative text-center"
              >
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[60%] w-full h-px border-t-2 border-dashed border-primary/20" />
                )}
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-extrabold text-lg mb-5">
                  {n}
                </div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="py-12 px-4 md:px-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-muted-foreground">
          {[
            { icon: Shield, text: "Secure & private — your data is yours" },
            { icon: Star, text: "4.9/5 average user rating" },
            { icon: Zap, text: "Results in under 30 seconds" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-4 md:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-br from-primary/90 to-lime-500 p-10 md:p-16 text-center shadow-2xl shadow-primary/20"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-primary-foreground mb-4">
            Ready to accelerate your career?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-md mx-auto">
            Join thousands of job seekers who've already used HireBoost AI to land better roles faster.
          </p>
          <Link href={cta}>
            <Button
              size="lg"
              variant="secondary"
              className="h-13 px-10 text-base font-bold bg-white text-primary hover:bg-white/90 shadow-xl hover:scale-[1.03] transition-transform"
            >
              Start for Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
