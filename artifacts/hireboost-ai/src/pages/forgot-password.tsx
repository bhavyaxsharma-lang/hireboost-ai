import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "Something went wrong.", variant: "destructive" });
        return;
      }
      setSubmitted(true);
    } catch {
      toast({ title: "Network error", description: "Could not connect. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        <button
          onClick={() => setLocation("/auth")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </button>

        <div className="mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Forgot your password?</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
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
            <Button type="submit" className="w-full h-11 font-bold" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-center">
              <p className="text-sm font-medium text-foreground">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                If <span className="font-semibold">{email}</span> is registered, we've sent a password reset link to that address. The link expires in 1 hour.
              </p>
            </div>
            <Button
              variant="link"
              className="w-full text-primary"
              onClick={() => setLocation("/auth")}
            >
              Back to login
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
