import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ArrowLeft, KeyRound, MailCheck, Eye, EyeOff,
  ShieldCheck, RefreshCw,
} from "lucide-react";

type Step = "email" | "otp" | "done";

const OTP_EXPIRY_SEC = 5 * 60; // 5 minutes
const RESEND_COOLDOWN_SEC = 30;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Countdown timers
  const [expiryLeft, setExpiryLeft] = useState(OTP_EXPIRY_SEC);
  const [resendLeft, setResendLeft] = useState(0);

  // Start countdown timers when OTP step begins
  useEffect(() => {
    if (step !== "otp") return;

    setExpiryLeft(OTP_EXPIRY_SEC);
    setResendLeft(RESEND_COOLDOWN_SEC);

    // Auto-focus OTP input
    setTimeout(() => otpInputRef.current?.focus(), 100);

    const interval = setInterval(() => {
      setExpiryLeft((s) => Math.max(0, s - 1));
      setResendLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const sendOtp = async (isResend = false) => {
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Something went wrong.", variant: "destructive" });
        return;
      }
      if (isResend) {
        setOtp("");
        setExpiryLeft(OTP_EXPIRY_SEC);
        setResendLeft(RESEND_COOLDOWN_SEC);
        toast({ title: "OTP resent", description: "A new 6-digit code has been sent to your inbox." });
      } else {
        setStep("otp");
      }
    } catch {
      toast({ title: "Network error", description: "Could not connect. Please try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp(false);
  };

  const handleResendOtp = async () => {
    if (resendLeft > 0) return;
    await sendOtp(true);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter the full 6-digit code.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Both fields must be identical.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-otp-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json() as { message?: string; error?: string; expired?: boolean };

      if (!res.ok) {
        if (data.expired) {
          toast({
            title: "OTP expired",
            description: "Your code has expired. Please request a new one.",
            variant: "destructive",
          });
          setOtp("");
          setExpiryLeft(0);
        } else {
          toast({ title: "Error", description: data.error ?? "Something went wrong.", variant: "destructive" });
        }
        return;
      }
      setStep("done");
    } catch {
      toast({ title: "Network error", description: "Could not connect. Please try again.", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-start justify-center p-5 pt-8 pb-12 bg-background overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Back button */}
        <button
          onClick={() => step === "otp" ? setStep("email") : setLocation("/auth")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === "otp" ? "Back" : "Back to login"}
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            {step === "done"
              ? <ShieldCheck className="h-6 w-6 text-primary" />
              : step === "otp"
              ? <MailCheck className="h-6 w-6 text-primary" />
              : <KeyRound className="h-6 w-6 text-primary" />}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {step === "done"
              ? "Password updated!"
              : step === "otp"
              ? "Enter your OTP"
              : "Reset your password"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === "done"
              ? "Your password has been reset successfully."
              : step === "otp"
              ? `We sent a 6-digit code to ${email}`
              : "Enter your email and we'll send you a one-time code."}
          </p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Email ── */}
          {step === "email" && (
            <motion.form
              key="email-step"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSendOtp}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSending}
                  className="h-11 w-full"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <Button type="submit" className="w-full h-11 font-bold" disabled={isSending}>
                {isSending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending OTP…</>
                  : "Send OTP"}
              </Button>
            </motion.form>
          )}

          {/* ── Step 2: OTP + New Password ── */}
          {step === "otp" && (
            <motion.form
              key="otp-step"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleVerify}
              className="space-y-4"
            >
              {/* Expiry countdown */}
              <div className={`flex items-center justify-between text-xs px-1 ${expiryLeft === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                <span>{expiryLeft > 0 ? "OTP expires in" : "OTP has expired"}</span>
                {expiryLeft > 0 && (
                  <span className="font-mono font-semibold">{formatTime(expiryLeft)}</span>
                )}
              </div>

              {/* OTP input */}
              <div className="space-y-1.5">
                <Label htmlFor="otp">6-digit OTP</Label>
                <Input
                  id="otp"
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="123456"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={isVerifying || expiryLeft === 0}
                  className="h-12 w-full text-center text-2xl font-mono tracking-[0.4em] placeholder:tracking-normal placeholder:text-base"
                  autoComplete="one-time-code"
                />
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    placeholder="At least 8 characters"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isVerifying}
                    className="h-11 pr-10 w-full"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your new password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isVerifying}
                    className="h-11 pr-10 w-full"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-bold"
                disabled={isVerifying || otp.length !== 6 || expiryLeft === 0}
              >
                {isVerifying
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                  : "Reset Password"}
              </Button>

              {/* Resend OTP */}
              <div className="text-center pt-1">
                {resendLeft > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Resend available in <span className="font-mono font-semibold">{resendLeft}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSending}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline mx-auto disabled:opacity-50"
                  >
                    {isSending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    Resend OTP
                  </button>
                )}
              </div>
            </motion.form>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && (
            <motion.div
              key="done-step"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-center space-y-1">
                <p className="text-sm font-medium">All done!</p>
                <p className="text-sm text-muted-foreground">
                  You can now sign in with your new password.
                </p>
              </div>
              <Button className="w-full h-11 font-bold" onClick={() => setLocation("/auth")}>
                Go to login
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
