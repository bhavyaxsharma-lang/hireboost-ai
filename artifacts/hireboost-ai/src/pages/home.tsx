import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, TrendingUp, Mic } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <section className="flex-1 flex flex-col md:flex-row items-center justify-center px-4 md:px-8 py-12 md:py-24 max-w-6xl mx-auto w-full gap-8 md:gap-16">
        <motion.div 
          className="flex-1 flex flex-col items-start gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <TrendingUp className="mr-2 h-4 w-4" />
            Supercharge Your Career
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight lg:leading-tight text-foreground">
            Master your <span className="text-primary">interview</span> & nail the <span className="text-primary">resume</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] leading-relaxed">
            HireBoost AI gives you the edge. Instantly score your resume against ATS systems and practice with AI-driven mock interviews tailored to your role.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-4">
            <Link href={isAuthenticated ? "/dashboard" : "/auth"}>
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-6 mt-4 text-sm font-medium text-muted-foreground">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> ATS Scoring</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Mock Interviews</div>
          </div>
        </motion.div>
        
        <motion.div 
          className="flex-1 w-full max-w-[500px] relative aspect-square"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-3xl opacity-50" />
          <img 
            src="/hero.png" 
            alt="Futuristic career portal" 
            className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
          />
        </motion.div>
      </section>

      <section className="bg-secondary/50 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-12">
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <div className="h-12 w-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center mb-6">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Resume Analyzer</h3>
            <p className="text-muted-foreground mb-6">Paste your resume and the job description. Our AI analyzes missing keywords, formats, and strengths to maximize your ATS score.</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm font-medium"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Instant 0-100 ATS Score</li>
              <li className="flex items-center gap-3 text-sm font-medium"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Keyword Gap Analysis</li>
              <li className="flex items-center gap-3 text-sm font-medium"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Actionable Improvements</li>
            </ul>
          </div>
          
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <div className="h-12 w-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center mb-6">
              <Mic className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Mock Interviews</h3>
            <p className="text-muted-foreground mb-6">Select your role and difficulty. Answer questions in a chat interface and receive immediate, actionable feedback on every response.</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm font-medium"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Role-specific Questions</li>
              <li className="flex items-center gap-3 text-sm font-medium"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Real-time Answer Rating</li>
              <li className="flex items-center gap-3 text-sm font-medium"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Detailed AI Feedback</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
