import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * Token-based password reset has been replaced with OTP-based reset.
 * This page redirects any old /reset-password?token=... links to /forgot-password.
 */
export default function ResetPassword() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/forgot-password");
  }, [setLocation]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
