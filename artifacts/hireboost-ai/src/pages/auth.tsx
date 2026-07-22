import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  removeLocalStorageItem,
  setLocalStorageItem,
  setSessionStorageItem,
} from "@/lib/storage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, FileText, Video, ClipboardList, TrendingUp } from "lucide-react";

const perks = [
  { icon: FileText, text: "Instant ATS Resume Scoring" },
  { icon: Video, text: "AI Mock Interviews with Feedback" },
  { icon: ClipboardList, text: "JD Interview Prep" },
  { icon: TrendingUp, text: "Salary Negotiation Scripts" },
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPreparingSignup, setIsPreparingSignup] = useState(false);

  const loginMutation = useLoginUser();
  const isLoading = loginMutation.isPending || isPreparingSignup;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLogin) {
      loginMutation.mutate(
        {
          data: {
            email: email.trim(),
            password,
          },
        },
        {
          onSuccess: (data: any) => {
            if (import.meta.env.DEV) {
              console.log("LOGIN RESPONSE:", data);
            }

            if (data?.token) {
              removeLocalStorageItem("authToken");
              removeLocalStorageItem("userName");
              removeLocalStorageItem("userEmail");

              setLocalStorageItem("authToken", data.token);
              setLocalStorageItem(
                "userName",
                data?.user?.name || data?.name || ""
              );
              setLocalStorageItem(
                "userEmail",
                data?.user?.email || email.trim()
              );
            }

            toast({
              title: "Welcome back!",
            });

            setLocation("/dashboard");
          },

          onError: (error: any) => {
            toast({
              title: "Login Failed",
              description:
                error?.error || "Please check your credentials.",
              variant: "destructive",
            });
          },
        }
      );

      return;
    }

    if (name.trim().length < 2) {
      toast({
        title: "Invalid Name",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please confirm your password exactly.",
        variant: "destructive",
      });
      return;
    }

    setIsPreparingSignup(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          purpose: "signup",
        }),
      });
      const data = await res.json() as { message?: string; error?: string };

      if (!res.ok) {
        toast({
          title: "Unable to start signup",
          description: data.error || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      setSessionStorageItem(
        "pendingSignup",
        JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        })
      );

      toast({
        title: "Verify your email to continue",
        description: "We've sent a 6-digit verification code to your email address. Enter the OTP to activate your HireBoost AI account.",
      });

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setLocation("/verify-email");
    } catch {
      toast({
        title: "Network error",
        description: "Could not connect. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingSignup(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex">
      {/* ── Left branding panel — photo background ── */}
      <div
        className="hidden lg:flex flex-col flex-1 p-12 justify-between relative overflow-hidden select-none"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1400&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark gradient overlay so text stays legible */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/55 to-primary/60" />

        {/* Content above overlay */}
        <div className="relative z-10">
          <div className="text-2xl font-extrabold text-white tracking-tight mb-2">
            HireBoost <span className="opacity-80">AI</span>
          </div>
          <p className="text-white/70 text-sm">Your AI-powered career platform</p>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-extrabold text-white leading-tight">
            Everything you need to land your next job
          </h2>
          <div className="space-y-4">
            {perks.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 border border-white/30 shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-white/60 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          No credit card required · Free to start
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-start justify-center p-6 pt-8 pb-10 bg-background overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight">
              {isLogin ? "Sign in to your account" : "Create your account"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isLogin ? "Welcome back — enter your details below." : "Get started free — no card needed."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Rahul Sharma"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-11"
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-bold shadow-lg shadow-primary/20 mt-2"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <Button
              variant="link"
              className="p-0 font-semibold text-primary h-auto"
              onClick={() => setIsLogin(!isLogin)}
              disabled={isLoading}
            >
              {isLogin ? "Sign up free" : "Sign in"}
            </Button>
          </div>

          {/* Mobile perks */}
          <div className="mt-8 pt-6 border-t border-border/50 lg:hidden space-y-3">
            {perks.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
