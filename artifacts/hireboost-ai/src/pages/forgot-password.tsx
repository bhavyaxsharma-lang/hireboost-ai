import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail, Copy, CheckCheck } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      } else {
        toast({ title: "Check your email", description: data.message });
      }
    } catch {
      toast({ title: "Network error", description: "Could not connect. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!resetUrl) return;
    await navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Enter your email and we'll generate a reset link for you.
          </p>
        </div>

        {!resetUrl ? (
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
              Generate Reset Link
            </Button>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Your password reset link:</p>
              <p className="text-xs text-muted-foreground break-all bg-background rounded-lg p-3 border border-border font-mono">
                {resetUrl}
              </p>
              <Button
                variant="outline"
                className="w-full h-10 gap-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <><CheckCheck className="h-4 w-4 text-green-500" /> Copied!</>
                ) : (
                  <><Copy className="h-4 w-4" /> Copy Link</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              This link expires in <span className="font-semibold">1 hour</span>. Open it in your browser to set a new password.
            </p>
            <Button
              variant="link"
              className="w-full text-primary"
              onClick={() => setLocation(resetUrl.replace(window.location.origin, ""))}
            >
              Open reset link now →
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
