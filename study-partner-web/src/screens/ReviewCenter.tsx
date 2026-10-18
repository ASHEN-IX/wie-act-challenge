'use client';
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { reviewAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import {
  Brain,
  CheckCircle,
  RotateCcw,
  Clock,
  TrendingUp,
  Loader2,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const QUALITY_OPTIONS = [
  {
    value: 0,
    label: "Blackout",
    color: "bg-[var(--accent-color-dynamic)]",
    desc: "No recall at all",
  },
  {
    value: 1,
    label: "Wrong",
    color: "bg-[var(--accent-color-dynamic)]",
    desc: "Wrong answer, but recognized correct one",
  },
  {
    value: 2,
    label: "Hard",
    color: "bg-[var(--accent-color-dynamic)]",
    desc: "Correct with serious difficulty",
  },
  {
    value: 3,
    label: "OK",
    color: "bg-[var(--accent-color-dynamic)]",
    desc: "Correct with some hesitation",
  },
  {
    value: 4,
    label: "Good",
    color: "bg-[var(--accent-color-dynamic)]",
    desc: "Correct with minor hesitation",
  },
  {
    value: 5,
    label: "Perfect",
    color: "bg-[var(--accent-color-dynamic)]",
    desc: "Instant perfect recall",
  },
];

const ReviewCenter = () => {
  const { user } = useAuthStore();
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionResults, setSessionResults] = useState<any[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [pending, reviewStats] = await Promise.all([
        reviewAPI.getPending(user._id, 30),
        reviewAPI.getStats(user._id),
      ]);
      setPendingReviews(pending.reviews || pending || []);
      setStats(reviewStats);
    } catch (err: any) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startReview = () => {
    setIsReviewing(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setSessionResults([]);
  };

  const handleQuality = async (quality: any) => {
    const current = pendingReviews[currentIndex];
    if (!current) return;

    const reviewId =
      current.review_id ||
      current.reviewId ||
      current._id ||
      current.id ||
      current.topicId;

    try {
      await reviewAPI.recordResult({
        user_id: user._id,
        review_id: reviewId,
        quality_score: quality,
      });

      setSessionResults((prev: any) => [
        ...prev,
        {
          title: current.subtopicTitle || current.topicTitle || "Review Item",
          quality,
        },
      ]);
    } catch (err: any) {
      console.error("Failed to record result:", err);
    }

    // Move to next
    if (currentIndex + 1 < pendingReviews.length) {
      setCurrentIndex((prev: any) => prev + 1);
      setShowAnswer(false);
    } else {
      setIsReviewing(false);
      fetchData(); // Refresh
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentCard = pendingReviews[currentIndex];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-3 mb-3">
          <Brain className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Review Center</h1>
        </div>
        <p className="text-muted-foreground">
          Spaced repetition powered reviews to strengthen your memory
        </p>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <Clock className="w-5 h-5 mx-auto mb-2 text-[var(--accent-color-dynamic)]" />
            <p className="text-2xl font-bold text-foreground">
              {pendingReviews.length}
            </p>
            <p className="text-xs text-muted-foreground">Due Now</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-2 text-[var(--accent-color-dynamic)]" />
            <p className="text-2xl font-bold text-foreground">
              {stats.totalReviewed || 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Reviewed</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-foreground">
              {stats.averageQuality?.toFixed(1) || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Avg Quality</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <Sparkles className="w-5 h-5 mx-auto mb-2 text-[var(--accent-color-dynamic)]" />
            <p className="text-2xl font-bold text-foreground">
              {stats.masteredCount || 0}
            </p>
            <p className="text-xs text-muted-foreground">Mastered</p>
          </div>
        </motion.div>
      )}

      {/* Review Mode */}
      {isReviewing && currentCard ? (
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto"
        >
          {/* Progress */}
          <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
            <span>
              Card {currentIndex + 1} of {pendingReviews.length}
            </span>
            <span>{sessionResults.length} answered</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{
                width: `${((currentIndex + 1) / pendingReviews.length) * 100}%`,
              }}
            />
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-border bg-card p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
              {currentCard.topicTitle || "Topic"}
            </p>
            <h2 className="text-xl font-semibold text-foreground mb-6">
              {currentCard.subtopicTitle ||
                currentCard.question ||
                "What do you remember about this topic?"}
            </h2>

            {currentCard.keyConcepts && currentCard.keyConcepts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {currentCard.keyConcepts.slice(0, 5).map((concept: any, i: any) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs bg-primary/10 text-primary"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            )}

            {!showAnswer ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAnswer(true)}
                className="mt-4 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2"
              >
                Show Answer <ChevronRight className="w-4 h-4" />
              </motion.button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full mt-4"
              >
                {currentCard.summary && (
                  <p className="text-sm text-muted-foreground mb-6 p-4 rounded-xl bg-muted/50">
                    {currentCard.summary}
                  </p>
                )}
                <p className="text-sm font-medium text-foreground mb-4">
                  How well did you remember?
                </p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {QUALITY_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuality(opt.value)}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl border border-border hover:border-primary/50 transition-colors"
                      title={opt.desc}
                    >
                      <div className={`w-4 h-4 rounded-full ${opt.color}`} />
                      <span className="text-xs font-medium text-foreground">
                        {opt.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      ) : (
        /* Summary / Start View */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          {/* Session Summary */}
          {sessionResults.length > 0 && (
            <div className="max-w-xl mx-auto mb-8 p-6 rounded-2xl border border-border bg-card">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5 text-[var(--accent-color-dynamic)]" />{" "}
                Session Complete!
              </h3>
              <div className="flex justify-center gap-6 mb-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {sessionResults.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Reviewed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--accent-color-dynamic)]">
                    {sessionResults.filter((r) => r.quality >= 3).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Correct</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--accent-color-dynamic)]">
                    {sessionResults.filter((r) => r.quality < 3).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Needs Work</p>
                </div>
              </div>
            </div>
          )}

          {pendingReviews.length > 0 ? (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-color-dynamic)]/10 text-[var(--accent-color-dynamic)] text-sm font-medium mb-4">
                  <Clock className="w-4 h-4" />
                  {pendingReviews.length} review
                  {pendingReviews.length !== 1 ? "s" : ""} due
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startReview}
                className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg flex items-center gap-3 mx-auto"
              >
                <RotateCcw className="w-5 h-5" />
                Start Review Session
              </motion.button>
            </>
          ) : (
            <div className="p-12 rounded-2xl border border-border bg-card">
              <CheckCircle className="w-12 h-12 text-[var(--accent-color-dynamic)] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                All caught up!
              </h3>
              <p className="text-muted-foreground">
                No reviews due right now. Great job staying on top of your
                studies!
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ReviewCenter;
