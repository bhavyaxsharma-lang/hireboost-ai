import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, MailCheck, ShieldCheck, RefreshCw } from "lucide-react";
import { getSessionStorageItem, removeSessionStorageItem, setLocalStorageItem } from "@/lib/storage";

const OTP_EXPIRY_SEC = 5 * 60;
const RESEND_COOLDOWN_SEC = 30;

type Step = "otp" | "done";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("otp");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [expiryLeft, setExpiryLeft] = useState(OTP_EXPIRY_SEC);
  const [resendLeft, setResendLeft] = useState(0);
  const [pendingSignup, setPendingSignup] = useState<{ name: string; email: string; password: string } | null>(null);

  useEffect(() => {
    const value = getSessionStorageItem("pendingSignup");
    if (!value) {
      setLocation("/auth");
      return;
    }

    try {
      const parsed = JSON.parse(value) as { name?: string; email?: string; password?: string };
      if (!parsed?.email || !parsed?.name || !parsed?.password) {
        setLocation("/auth");
        return;
      }

      setPendingSignup({ name: parsed.name, email: parsed.email, password: parsed.password });
      setEmail(parsed.email);
    } catch {
      removeSessionStorageItem("pendingSignup");
      setLocation("/auth");
    }
  }, [setLocation]);

  useEffect(() => {
    if (step !== "otp") return;

    setExpiryLeft(OTP_EXPIRY_SEC);
    setResendLeft(RESEND_COOLDOWN_SEC);
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

  const handleResendOtp = async () => {
    if (resendLeft > 0 || !pendingSignup) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingSignup.email, purpose: "signup" }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Could not resend the verification code.", variant: "destructive" });
        return;
      }
      setOtp("");
      setExpiryLeft(OTP_EXPIRY_SEC);
      setResendLeft(RESEND_COOLDOWN_SEC);
      toast({ title: "OTP resent", description: "A new 6-digit code has been sent to your inbox." });
    } catch {
      toast({ title: "Network error", description: "Could not connect. Please try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSignup) return;

    if (otp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter the full 6-digit code.", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-signup-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingSignup.email,
          otp,
          name: pendingSignup.name,
          password: pendingSignup.password,
        }),
      });
      const data = await res.json() as { message?: string; error?: string; token?: string };

      if (!res.ok) {
        if (data.error?.toLowerCase().includes("expired") || data.error?.toLowerCase().includes("invalid")) {
          toast({ title: "OTP expired", description: "Your code has expired. Please request a new one.", variant: "destructive" });
          setOtp("");
          setExpiryLeft(0);
        } else {
          toast({ title: "Verification Failed", description: data.error ?? "Unable to verify your account.", variant: "destructive" });
        }
        return;
      }

      removeSessionStorageItem("pendingSignup");
      if (data.token) {
        setLocalStorageItem("authToken", data.token);
        setLocalStorageItem("userName", pendingSignup.name);
        setLocalStorageItem("userEmail", pendingSignup.email);
      }
      setLocation("/dashboard");
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
        <button
          onClick={() => step === "otp" ? setLocation("/auth") : setLocation("/auth")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            {step === "done" ? <ShieldCheck className="h-6 w-6 text-primary" /> : <MailCheck className="h-6 w-6 text-primary" />}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {step === "done" ? "Account verified!" : "Verify your Email"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === "done"
              ? "Your account is ready. You will be redirected to your dashboard shortly."
              : `We sent a 6-digit verification code to ${email}`}
          </p>
        </div>

        {step === "otp" ? (
          <motion.form
            key="otp-step"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleVerify}
            className="space-y-4"
          >
            <div className={`flex items-center justify-between text-xs px-1 ${expiryLeft === 0 ? "text-destructive" : "text-muted-foreground"}`}>
              <span>{expiryLeft > 0 ? "OTP expires in" : "OTP has expired"}</span>
              {expiryLeft > 0 && <span className="font-mono font-semibold">{formatTime(expiryLeft)}</span>}
            </div>

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

            <Button type="submit" className="w-full h-11 font-bold" disabled={isVerifying || otp.length !== 6 || expiryLeft === 0}>
              {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : "Verify & Create Account"}
            </Button>

            <div className="text-center pt-1">
              {resendLeft > 0 ? (
                <p className="text-xs text-muted-foreground">Resend available in <span className="font-mono font-semibold">{resendLeft}s</span></p>
              ) : (
                <button type="button" onClick={handleResendOtp} disabled={isSending} className="flex items-center gap-1.5 text-xs text-primary hover:underline mx-auto disabled:opacity-50">
                  {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Resend OTP
                </button>
              )}
            </div>
          </motion.form>
        ) : (
          <motion.div key="done-step" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center space-y-1">
              <p className="text-sm font-medium">All done!</p>
              <p className="text-sm text-muted-foreground">Your account is verified and ready to use.</p>
            </div>
            <Button className="w-full h-11 font-bold" onClick={() => setLocation("/dashboard")}>Go to dashboard</Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
