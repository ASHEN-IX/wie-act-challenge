'use client';
import React, { useEffect, useState } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "@/navigation";
import { motion } from "framer-motion";
import { authAPI } from "../services/api";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(token ? "verifying" : searchParams?.get("verified") === "true" ? "success" : "idle"); // idle | verifying | success | error
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(searchParams?.get("email") || "");
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    authAPI
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email has been verified! You can now log in.");
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(
          err.response?.data?.error ||
            "Verification failed. The link may have expired.",
        );
      });
  }, [token]);

  useEffect(() => {
    if (!resendCooldown) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev: any) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleOtpVerification = async (event: any) => {
    event.preventDefault();
    if (!email || !otp) {
      setStatus("error");
      setMessage("Email and OTP are required.");
      return;
    }

    setStatus("verifying");
    setMessage("");
    try {
      await authAPI.verifyOtp(email.trim().toLowerCase(), otp);
      setStatus("success");
      setMessage("Your email has been verified! You can now log in.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.error || "OTP verification failed.");
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0 || resending) return;
    try {
      setResending(true);
      await authAPI.resendVerification(email.trim().toLowerCase());
      setMessage("A new verification email and OTP have been sent.");
      setStatus("idle");
      setResendCooldown(60);
    } catch (err: any) {
      setStatus("error");
      setMessage(
        err.response?.data?.error || "Failed to resend verification email.",
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            STUDY<span className="text-primary">PARTNER</span>
          </h1>
          <p className="text-muted-foreground">Verify your email</p>
        </div>

        <div className="card-valorant p-8 text-center">
          {status === "idle" && (
            <>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Verify with OTP
              </h2>
              <p className="text-muted-foreground mb-6">
                Enter your email and 6-digit verification code.
              </p>
              <form
                onSubmit={handleOtpVerification}
                className="space-y-3 text-left"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <input
                  type="text"
                  value={otp}
                  onChange={(e: any) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit OTP"
                  className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors"
                >
                  Verify OTP
                </button>
              </form>

              <button
                type="button"
                onClick={handleResend}
                disabled={!email || resending || resendCooldown > 0}
                className="mt-4 text-sm text-primary disabled:text-muted-foreground"
              >
                {resending
                  ? "Resending..."
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend verification email"}
              </button>
            </>
          )}

          {status === "verifying" && (
            <>
              <Loader2
                className="mx-auto text-primary animate-spin mb-4"
                size={48}
              />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Verifying your email...
              </h2>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle
                className="mx-auto text-[var(--accent-color-dynamic)] mb-4"
                size={48}
              />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Email Verified!
              </h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors"
              >
                Go to Login
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="mx-auto text-destructive mb-4" size={48} />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Verification Failed
              </h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <div className="space-y-3">
                <button
                  onClick={() => setStatus("idle")}
                  className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors"
                >
                  Try OTP Again
                </button>
                <Link
                  to="/login"
                  className="block w-full border border-border text-foreground font-bold py-3 px-4 transition-colors hover:bg-muted"
                >
                  Go to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
