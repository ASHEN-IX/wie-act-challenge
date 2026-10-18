'use client';
import React, { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "@/navigation";
import { motion } from "framer-motion";
import { authAPI } from "../services/api";
import { Lock, CheckCircle, XCircle } from "lucide-react";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export default function ResetPassword() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = pathToken || searchParams?.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("form"); // form | success | error
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");

    if (!PASSWORD_RULE.test(password)) {
      setError(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setError(err.response?.data?.error || "Failed to reset password.");
    } finally {
      setLoading(false);
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
          <p className="text-muted-foreground">Set your new password</p>
        </div>

        <div className="card-valorant p-8">
          {status === "success" ? (
            <div className="text-center">
              <CheckCircle
                className="mx-auto text-[var(--accent-color-dynamic)] mb-4"
                size={48}
              />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Password Reset!
              </h2>
              <p className="text-muted-foreground mb-6">
                Your password has been updated. You can now log in.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors"
              >
                Go to Login
              </button>
            </div>
          ) : status === "error" && !error ? (
            <div className="text-center">
              <XCircle className="mx-auto text-destructive mb-4" size={48} />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Reset Failed
              </h2>
              <p className="text-muted-foreground mb-6">
                This link may have expired.
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                className="w-full border border-border text-foreground font-bold py-3 px-4 transition-colors hover:bg-muted"
              >
                Request New Link
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Lock className="text-primary" size={24} />
                <h2 className="text-xl font-bold text-foreground">
                  Set New Password
                </h2>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive text-destructive text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e: any) => setPassword(e.target.value)}
                  placeholder="New password"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e: any) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
