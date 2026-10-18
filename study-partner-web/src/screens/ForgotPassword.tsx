'use client';
import React, { useState } from "react";
import { Link } from "@/navigation";
import { motion } from "framer-motion";
import { authAPI } from "../services/api";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong.");
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
          <p className="text-muted-foreground">Reset your password</p>
        </div>

        <div className="card-valorant p-8">
          {sent ? (
            <div className="text-center">
              <CheckCircle
                className="mx-auto text-[var(--accent-color-dynamic)] mb-4"
                size={48}
              />
              <h2 className="text-xl font-bold text-foreground mb-2">
                Check your email
              </h2>
              <p className="text-muted-foreground mb-6">
                If an account exists with that email, we&apos;ve sent a password
                reset link.
              </p>
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 text-sm"
              >
                &larr; Back to Login
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Mail className="text-primary" size={24} />
                <h2 className="text-xl font-bold text-foreground">
                  Forgot Password
                </h2>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Enter your email and we&apos;ll send you a link to reset your
                password.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive text-destructive text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition"
                >
                  <ArrowLeft size={14} />
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
