'use client';
import React, { useState } from "react";
import { useNavigate, Link } from "@/navigation";
import { motion } from "framer-motion";
import { authAPI } from "../services/api";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const parseCsvList = (value: any) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    studyGoalsInput: "",
    preferredSubjectsInput: "",
    weeklyHours: "",
    studyLevel: "beginner",
    studyTime: "evening",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    language: "en",
    notifyEmail: true,
    notifyPush: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event: any) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setError("Full name is required.");
        return false;
      }
      if (!formData.email.trim()) {
        setError("Email is required.");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return false;
      }
      if (!PASSWORD_RULE.test(formData.password)) {
        setError(
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        );
        return false;
      }
    }

    if (step === 2) {
      if (formData.weeklyHours && Number(formData.weeklyHours) < 0) {
        setError("Weekly study hours cannot be negative.");
        return false;
      }
    }

    setError("");
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((prev: any) => Math.min(prev + 1, 3));
  };

  const goBack = () => {
    setError("");
    setStep((prev: any) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    if (!validateStep()) return;

    setLoading(true);
    try {
      await authAPI.register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        onboarding: {
          studyGoals: parseCsvList(formData.studyGoalsInput),
          preferredSubjects: parseCsvList(formData.preferredSubjectsInput),
          weeklyHours: Number(formData.weeklyHours || 0),
          studyLevel: formData.studyLevel,
          studyTime: formData.studyTime,
          timezone: formData.timezone,
          language: formData.language,
          notificationPreferences: {
            email: formData.notifyEmail,
            push: formData.notifyPush,
          },
        },
      });

      navigate(
        `/verify-email?email=${encodeURIComponent(formData.email.trim())}`,
      );
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            STUDY<span className="text-primary">PARTNER</span>
          </h1>
          <p className="text-muted-foreground">Create your account</p>
        </div>

        <div className="card-valorant p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold ${
                    step >= item
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {item}
                </div>
                {item < 3 && <div className="w-10 h-[1px] bg-border" />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  Account Details
                </h2>
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    8+ chars, uppercase, lowercase, number, special char.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  Learning Profile
                </h2>
                <div>
                  <label
                    htmlFor="studyGoalsInput"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Study Goals (comma-separated)
                  </label>
                  <input
                    id="studyGoalsInput"
                    name="studyGoalsInput"
                    type="text"
                    value={formData.studyGoalsInput}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="Pass finals, Improve focus, Build daily habit"
                  />
                </div>

                <div>
                  <label
                    htmlFor="preferredSubjectsInput"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Preferred Subjects (comma-separated)
                  </label>
                  <input
                    id="preferredSubjectsInput"
                    name="preferredSubjectsInput"
                    type="text"
                    value={formData.preferredSubjectsInput}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="Math, Biology, Programming"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="weeklyHours"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Weekly Study Hours
                    </label>
                    <input
                      id="weeklyHours"
                      name="weeklyHours"
                      type="number"
                      min="0"
                      max="120"
                      value={formData.weeklyHours}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="studyLevel"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Current Level
                    </label>
                    <select
                      id="studyLevel"
                      name="studyLevel"
                      value={formData.studyLevel}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background border border-border text-foreground focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold text-foreground">
                  Preferences
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="studyTime"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Preferred Study Time
                    </label>
                    <select
                      id="studyTime"
                      name="studyTime"
                      value={formData.studyTime}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background border border-border text-foreground focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                      <option value="night">Night</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="language"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Language
                    </label>
                    <input
                      id="language"
                      name="language"
                      type="text"
                      value={formData.language}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      placeholder="en"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="timezone"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Timezone
                  </label>
                  <input
                    id="timezone"
                    name="timezone"
                    type="text"
                    value={formData.timezone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    placeholder="UTC"
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="notifyEmail"
                      checked={formData.notifyEmail}
                      onChange={handleChange}
                    />
                    Email notifications
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="notifyPush"
                      checked={formData.notifyPush}
                      onChange={handleChange}
                    />
                    Push notifications
                  </label>
                </div>
              </>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="w-full border border-border text-foreground font-bold py-3 px-4 transition-colors hover:bg-muted"
                >
                  BACK
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors"
                >
                  NEXT
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary text-primary-foreground font-bold py-3 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-primary hover:text-primary transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
