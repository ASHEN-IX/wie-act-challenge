'use client';
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  SkipForward,
  Trophy,
  Zap,
  Clock,
  BookOpen,
  ArrowLeft,
  Play,
  Target,
  RotateCcw,
  Brain,
} from "lucide-react";
import {
  aiAPI,
  notificationAPI,
  focusAPI,
  sessionsAPI,
  gamificationAPI,
  teamSessionsAPI,
  profileAPI,
  reviewAPI,
  analyticsAPI,
} from "../services/api";
import { useAuthStore } from "../store/authStore";
import useSessionStore from "../store/sessionStore";
import useGamificationStore from "../store/gamificationStore";
import WebcamCapture from "../components/WebcamCapture";
import ChatWindow from "../components/SessionChat/ChatWindow";
import TeamSessionPanel from "../components/TeamSessionPanel";
import VoiceButton from "../components/VoiceChat/VoiceButton";
import SocraticEvaluation from "../components/SocraticEvaluation";
const BYPASS_TASK_TIMING_GATE =
  String(process.env.NEXT_PUBLIC_BYPASS_TASK_TIMING_GATE || "").toLowerCase() ===
  "true";

// ─── Task Progress Bar ───────────────────────────────────────────────
const TaskProgressBar = ({ taskProgress }: any) => {
  if (!taskProgress?.tasks?.length) return null;
  const { tasks, completedTasks, totalTasks } = taskProgress;
  const progressPercent =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold tracking-wider text-gray-400 uppercase">
          Progress
        </span>
        <span className="text-sm font-bold text-white">
          {completedTasks}/{totalTasks} Tasks
        </span>
      </div>
      <div className="w-full h-3 bg-[#1a2633] rounded-full overflow-hidden border border-[#ffffff10]">
        <motion.div
          className="h-full bg-gradient-to-r from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]/70 rounded-full"
          initial={{
            width: 0,
          }}
          animate={{
            width: `${progressPercent}%`,
          }}
          transition={{
            duration: 0.5,
            ease: "easeOut",
          }}
        />
      </div>
      {/* Mini task indicators */}
      <div className="flex gap-1 mt-2">
        {tasks.map((task: any, idx: any) => (
          <div
            key={idx}
            className={`flex-1 h-1.5 rounded-full transition-colors ${task.status === "completed" ? "bg-[var(--accent-color-dynamic)]" : task.status === "skipped" ? "bg-[var(--accent-color-dynamic)]" : task.status === "in-progress" ? "bg-[var(--accent-color-dynamic)] animate-pulse" : "bg-[#1a2633]"}`}
            title={`${task.title} (${task.status})`}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Session Summary Screen ──────────────────────────────────────────
export const SessionSummary = ({ summary, onRestart, onGoHome }: any) => {
  const kpResult = summary?.kpResult || null;
  const completionRewards = summary?.completionRewards || null;
  const completionRank = completionRewards?.rank || null;
  const primaryBreakdown =
    kpResult?.primaryBreakdown ||
    kpResult?.events?.find((event: any) => event.action === "session_complete") ||
    kpResult?.events?.[0] ||
    null;
  const completionKPAwarded = Number(completionRank?.knowledgePointsAwarded);
  const rawTotalKP =
    kpResult?.totalKP ??
    summary?.totalKP ??
    (Number.isFinite(completionKPAwarded) ? completionKPAwarded : 0);
  const totalKP = Number.isFinite(Number(rawTotalKP)) ? Number(rawTotalKP) : 0;
  const completionRankName =
    completionRank?.name ||
    (Number.isFinite(Number(completionRank?.index))
      ? `Rank #${Number(completionRank.index) + 1}`
      : null);
  const completionTotalKnowledgePoints = Number(
    completionRank?.totalKnowledgePoints,
  );
  const completionKpToNextRank = Number(completionRank?.kpToNextRank);
  const difficultyMult = Number(primaryBreakdown?.multipliers?.difficulty || 1);
  const performanceMult = Number(
    primaryBreakdown?.multipliers?.performance || 1,
  );
  const consistencyMult = Number(
    primaryBreakdown?.multipliers?.consistency || 1,
  );
  const formulaFinal = Number(primaryBreakdown?.finalKP || 0);
  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.9,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      className="min-h-screen bg-[#0f1923] flex items-center justify-center relative overflow-hidden"
    >
      <div className="absolute inset-0 z-0 opacity-15">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent-color-dynamic)] rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-lg w-full p-8">
        <motion.div
          initial={{
            y: -20,
          }}
          animate={{
            y: 0,
          }}
          className="text-center mb-8"
        >
          <Trophy
            size={64}
            className="mx-auto text-[var(--accent-color-dynamic)] mb-4"
          />
          <h1 className="text-5xl font-black tracking-tighter uppercase text-white mb-2">
            SESSION COMPLETE
          </h1>
          <p className="text-gray-400 text-lg">{summary.courseTitle}</p>
        </motion.div>

        <div className="bg-[#1a2633] border border-[#ffffff10] rounded-2xl p-6 space-y-4 mb-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-[#0f1923] rounded-xl">
              <CheckCircle2
                size={24}
                className="mx-auto text-[var(--accent-color-dynamic)] mb-2"
              />
              <p className="text-2xl font-black text-white">
                {summary.completedTasks}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Completed
              </p>
            </div>
            <div className="text-center p-4 bg-[#0f1923] rounded-xl">
              <SkipForward
                size={24}
                className="mx-auto text-[var(--accent-color-dynamic)] mb-2"
              />
              <p className="text-2xl font-black text-white">
                {summary.skippedTasks}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                Skipped
              </p>
            </div>
          </div>

          <div className="border-t border-[#ffffff10] pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400">Total XP Earned</span>
              <span className="text-2xl font-black text-[var(--accent-color-dynamic)] flex items-center gap-1">
                <Zap size={20} />+{summary.totalXP}
              </span>
            </div>

            {totalKP > 0 && (
              <div className="mb-3 rounded-lg bg-[#0f1923] border border-[#ffffff10] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Knowledge Points Gained</span>
                  <span className="text-lg font-black text-[var(--accent-color-dynamic)]">
                    +{totalKP} KP
                  </span>
                </div>

                {primaryBreakdown && (
                  <div className="space-y-1 text-xs text-gray-300">
                    <div className="flex items-center justify-between">
                      <span>+ Base KP</span>
                      <span>{primaryBreakdown.baseKP || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>× Difficulty</span>
                      <span>{difficultyMult.toFixed(2)}x</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>× Performance</span>
                      <span>{performanceMult.toFixed(2)}x</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>× Streak</span>
                      <span>{consistencyMult.toFixed(2)}x</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#ffffff10] pt-1 mt-1 text-white font-bold">
                      <span>= Total KP gained</span>
                      <span>{formulaFinal || totalKP} KP</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {summary.xpMultiplier > 1 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">Team Multiplier</span>
                <span className="text-lg font-bold text-[var(--accent-color-dynamic)]">
                  {summary.xpMultiplier}x
                </span>
              </div>
            )}

            {(completionRankName ||
              Number.isFinite(completionTotalKnowledgePoints) ||
              Number.isFinite(completionKpToNextRank)) && (
              <div className="mb-3 rounded-lg border border-[#ffffff10] bg-[#0f1923] px-3 py-2">
                {completionRankName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Current Rank</span>
                    <span className="font-bold text-[var(--accent-color-dynamic)]">
                      {completionRankName}
                    </span>
                  </div>
                )}
                {Number.isFinite(completionTotalKnowledgePoints) && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-400">
                      Total Knowledge Points
                    </span>
                    <span className="font-bold text-white">
                      {completionTotalKnowledgePoints}
                    </span>
                  </div>
                )}
                {Number.isFinite(completionKpToNextRank) && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-400">KP to Next Rank</span>
                    <span className="font-bold text-white">
                      {completionKpToNextRank}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Tasks</span>
              <span className="text-lg font-bold text-white">
                {summary.totalTasks}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onRestart}
            className="flex-1 px-6 py-3 bg-[#1a2633] border border-[#ffffff10] text-white font-bold tracking-wider uppercase hover:bg-[#ffffff10] transition-all rounded-lg flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} /> STUDY AGAIN
          </button>
          <button
            onClick={onGoHome}
            className="flex-1 px-6 py-3 bg-[var(--accent-color-dynamic)] text-white font-bold tracking-wider uppercase hover:bg-[var(--accent-color-dynamic-hover)] transition-all rounded-lg flex items-center justify-center gap-2"
          >
            DASHBOARD
          </button>
        </div>
      </div>
    </motion.div>
  );
};
const StudySession = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const fetchLevelInfo = useGamificationStore((state) => state.fetchLevelInfo);
  const {
    step,
    activeSession,
    teamSession,
    inviteCode,
    taskProgress,
    sessionSummary,
    selectedCourse,
    completeTask,
    skipTask,
    finishSession,
    resetSession,
    loading: taskLoading,
  } = useSessionStore();

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [ignoredCount, setIgnoredCount] = useState(0);

  // Session ID refs (persist across renders without triggering re-renders)
  const studySessionIdRef = useRef<any>(null);
  const focusSessionIdRef = useRef<any>(null);

  // Break detection state
  const [breakCount, setBreakCount] = useState(0);
  const [currentBreakDuration, setCurrentBreakDuration] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [lastBreakNotification, setLastBreakNotification] = useState(0);

  // Signal state
  const [signals, setSignals] = useState<any>(null);
  const [signalHistory, setSignalHistory] = useState<any[]>([]);

  // Coach state
  const [coachDecision, setCoachDecision] = useState<any>(null);
  const [coachVisible, setCoachVisible] = useState(false);
  // Socratic evaluation state
  const [showSocratic, setShowSocratic] = useState(false);
  const [socraticTask, setSocraticTask] = useState<any>(null);

  // Timers
  const sessionTimerRef = useRef<any>(null);
  const signalPollingRef = useRef<any>(null);
  const coachPollingRef = useRef<any>(null);

  // ── Task-progression mode flag ──
  const hasTaskProgression = activeSession && taskProgress?.tasks?.length > 0;
  const isTeamSession =
    (activeSession?.type || teamSession?.type || "solo") === "team";
  const liveTeamSessionId =
    activeSession?._id || teamSession?._id || studySessionIdRef.current;
  const isTeamHost =
    String(activeSession?.userId || teamSession?.userId || "") ===
    String(user?._id || user?.userId || "");
  // Auto-start session when coming from setup flow
  useEffect(() => {
    if (hasTaskProgression && !sessionActive) {
      studySessionIdRef.current = activeSession._id;
      autoStartSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTaskProgression]);
  const handleTaskComplete = async () => {
    try {
      await completeTask();
    } catch (err: any) {
      console.error("[StudySession] completeTask failed:", err);
      return;
    }
    try {
      await Promise.all([
        fetchLevelInfo(),
        gamificationAPI.getProfile(),
        gamificationAPI.getRankProfile(),
      ]);
    } catch (err: any) {
      console.error("[StudySession] Failed to refresh gamification data:", err);
    }
    const completedIdx = taskProgress?.currentTaskIndex || 0;
    const completed = taskProgress?.tasks?.[completedIdx];
    if (completed) {
      setSocraticTask({
        title: completed.title,
        description: completed.description || completed.title,
        details: completed.description || completed.title,
      });
      setShowSocratic(true);
      // Schedule spaced repetition review for the completed task
      try {
        await reviewAPI.scheduleReview({
          user_id: user._id,
          task_id:
            completed.taskId || completed._id || completed.id || "mock-task-id",
          task_title: completed.title,
          task_description: completed.description || completed.title,
          task_details: completed.description || completed.title,
        });
      } catch (err: any) {
        console.error("[StudySession] Failed to schedule review:", err);
      }
    }
  };
  const autoStartSession = async () => {
    setSessionActive(true);
    setSessionDuration(0);
    try {
      const focusRes = await focusAPI.startSession({
        studySessionId: activeSession._id,
      });
      focusSessionIdRef.current = focusRes.data?.sessionId;
    } catch (err: any) {
      console.error("[StudySession] Failed to start focus tracking:", err);
    }
    sessionTimerRef.current = setInterval(
      () => setSessionDuration((p) => p + 1),
      1000,
    );
    signalPollingRef.current = setInterval(() => fetchSignals(), 10000);
    coachPollingRef.current = setInterval(() => requestCoachDecision(), 30000);
    fetchSignals();
    setTimeout(() => requestCoachDecision(), 5000);
  };

  // Handle frame capture from webcam
  const handleFrameCapture = async (frameBlob: any) => {
    if (!sessionActive || !user?._id) return;
    try {
      const formData = new FormData();
      formData.append("user_id", user._id);
      formData.append("frame", frameBlob, "frame.jpg");
      const response = await aiAPI.analyzeFrame(formData);
      const analysis = response.data;

      // Update signals state
      setSignals({
        timestamp: analysis.timestamp,
        focus: analysis.focus,
        fatigue: analysis.fatigue,
      });

      // Add to history
      setSignalHistory((prev: any) => [
        ...prev.slice(-50),
        {
          timestamp: new Date(analysis.timestamp),
          focus: analysis.focus.score,
          fatigue: analysis.fatigue.score,
        },
      ]);

      // Record focus data point in the FocusSession (signal-processing service)
      if (focusSessionIdRef.current) {
        try {
          await focusAPI.addDataPoint(focusSessionIdRef.current, {
            focusLevel: Math.round(analysis.focus.score * 100),
            isDistracted: analysis.focus.score < 0.4,
            gazeData: {
              x: 0,
              y: 0,
            },
          });
        } catch (err: any) {
          // Silent fail — don't interrupt the session for a data point
        }
      }

      // Break detection logic
      const isDistracted = analysis.focus.score < 0.3; // Low focus indicates distraction
      const breakThreshold = 30; // 30 seconds of continuous distraction
      const notificationCooldown = 300; // 5 minutes between break notifications

      if (isDistracted) {
        setCurrentBreakDuration((prev: any) => {
          const newDuration = prev + 10; // 10 seconds (polling interval)

          // Check if this constitutes a break
          if (newDuration >= breakThreshold && !isOnBreak) {
            setIsOnBreak(true);
            setBreakCount((prev: any) => prev + 1);

            // Send break notification if enough time has passed since last notification
            const now = Date.now();
            if (now - lastBreakNotification > notificationCooldown * 1000) {
              // Create break notification
              createBreakNotification();
              setLastBreakNotification(now);
            }
          }
          return newDuration;
        });
      } else {
        // Reset break detection if user is focused again
        if (isOnBreak) {
          setIsOnBreak(false);
          // Optionally notify user that break has ended
        }
        setCurrentBreakDuration(0);
      }
    } catch (error: any) {
      console.error("Failed to analyze frame:", error);
    }
  };

  // Create break notification
  const createBreakNotification = async () => {
    if (!user?._id) return;
    try {
      await notificationAPI.create({
        userId: user._id,
        type: "break_suggestion",
        title: "Break Detected",
        message: `You've been distracted for ${Math.round(currentBreakDuration)} seconds. Consider taking a short break to recharge.`,
        priority: "normal",
        metadata: {
          breakDuration: currentBreakDuration,
          sessionDuration: sessionDuration,
          breakCount: breakCount + 1,
        },
      });
    } catch (error: any) {
      console.error("Failed to create break notification:", error);
    }
  };

  // Start/stop session
  const toggleSession = () => {
    if (sessionActive) {
      stopSession();
    } else {
      startSession();
    }
  };
  const startSession = async () => {
    setSessionActive(true);
    setSessionDuration(0);
    setIgnoredCount(0);
    // Reset break detection state
    setBreakCount(0);
    setCurrentBreakDuration(0);
    setIsOnBreak(false);
    setLastBreakNotification(0);

    // Create a StudySession record in the backend
    try {
      const sessionRes = await sessionsAPI.create({
        status: "active",
      });
      const session = sessionRes.data?.session || sessionRes.data;
      studySessionIdRef.current = session._id;
      console.log("[StudySession] Created study session:", session._id);
    } catch (err: any) {
      console.error("[StudySession] Failed to create study session:", err);
    }

    // Start focus tracking session linked to the study session
    try {
      const focusRes = await focusAPI.startSession({
        studySessionId: studySessionIdRef.current,
      });
      focusSessionIdRef.current = focusRes.data?.sessionId;
      console.log(
        "[StudySession] Started focus tracking:",
        focusSessionIdRef.current,
      );
    } catch (err: any) {
      console.error("[StudySession] Failed to start focus tracking:", err);
    }

    // Reset fatigue detector state for new session
    try {
      await aiAPI.resetFatigue(user._id);
      console.log("[StudySession] Reset fatigue detector for new session");
    } catch (err: any) {
      console.error("[StudySession] Failed to reset fatigue detector:", err);
    }

    // Track session start event
    try {
      await analyticsAPI.trackEvent({
        eventType: "study_session_started",
      });
    } catch (err: any) {
      console.error("[StudySession] Failed to track session start:", err);
    }

    // Start session timer
    sessionTimerRef.current = setInterval(() => {
      setSessionDuration((prev: any) => prev + 1);
    }, 1000);

    // Start polling signals every 10 seconds
    signalPollingRef.current = setInterval(() => {
      fetchSignals();
    }, 10000);

    // Start polling coach every 30 seconds
    coachPollingRef.current = setInterval(() => {
      requestCoachDecision();
    }, 30000);

    // Initial fetch
    fetchSignals();
    setTimeout(() => requestCoachDecision(), 5000);
  };
  const stopSession = async () => {
    setSessionActive(false);

    // Clear all timers
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (signalPollingRef.current) {
      clearInterval(signalPollingRef.current);
      signalPollingRef.current = null;
    }
    if (coachPollingRef.current) {
      clearInterval(coachPollingRef.current);
      coachPollingRef.current = null;
    }
    const completedStudySessionId = studySessionIdRef.current;
    let completionRewards = null;

    // End focus tracking session and get summary
    let focusScore = 0;
    let focusSummary = null;
    if (focusSessionIdRef.current) {
      try {
        const focusEndRes = await focusAPI.endSession(
          focusSessionIdRef.current,
        );
        focusScore = focusEndRes.data?.focusScore || 0;
        focusSummary = focusEndRes.data?.summary;
        console.log(
          "[StudySession] Focus session ended:",
          focusScore,
          focusSummary,
        );
      } catch (err: any) {
        console.error("[StudySession] Failed to end focus session:", err);
      }
    }

    // End study session record with focus data
    if (studySessionIdRef.current) {
      try {
        if (isTeamSession) {
          if (isTeamHost) {
            const teamEndResult = await teamSessionsAPI.end(
              studySessionIdRef.current,
            );
            const rewards = Array.isArray(teamEndResult?.teamRewards)
              ? teamEndResult.teamRewards
              : [];
            const currentUserId = String(user?._id || user?.userId || "");
            completionRewards =
              rewards.find(
                (reward: any) => String(reward.userId) === currentUserId,
              ) || null;
            console.log("[StudySession] Team session ended");
          } else {
            await teamSessionsAPI.leave(studySessionIdRef.current);
            console.log("[StudySession] Left team session as participant");
          }
        } else {
          const sessionUpdateRes = await sessionsAPI.update(
            studySessionIdRef.current,
            {
              status: "completed",
              duration: sessionDuration,
              focusScore: focusSummary?.avgFocusLevel || focusScore,
              endTime: new Date().toISOString(),
            },
          );
          completionRewards = sessionUpdateRes?.data?.completionRewards || null;
          console.log("[StudySession] Study session ended");
        }
      } catch (err: any) {
        console.error("[StudySession] Failed to end study session:", err);
      }
    }
    // Evaluate session quality and surface actionable recommendations.
    try {
      const completedTasks = taskProgress?.completedTasks || 0;
      const skippedTasks = taskProgress?.skippedTasks || 0;
      const finalFocus = focusSummary?.avgFocusLevel || focusScore || 0;
      const evalRes = await aiAPI.evaluateSession({
        session_duration_minutes: Math.floor(sessionDuration / 60),
        focus_score: finalFocus,
        completed_tasks: completedTasks,
        skipped_tasks: skippedTasks,
      });
      const evaluation = evalRes?.data?.evaluation;
      // New API returns: state (mastery_confirmed/failed), mastery_score (0-1), feedback
      const isExcellent =
        evaluation?.state === "mastery_confirmed" &&
        evaluation?.mastery_score >= 0.85;
      const scorePercent = evaluation?.mastery_score
        ? Math.round(evaluation.mastery_score * 100)
        : 0;
      if (isExcellent) {
        await notificationAPI.create({
          userId: user._id,
          type: "achievement",
          title: "Excellent Study Session",
          message: `Session score ${scorePercent}/100. Keep this rhythm going!`,
          metadata: {
            actionUrl: "/analytics",
          },
          priority: "normal",
        });
      }
    } catch (err: any) {
      console.error("[StudySession] Session evaluation failed:", err);
    }

    // Update profile stats with session data
    try {
      await profileAPI.updateStats({
        studyTime: Math.floor(sessionDuration / 60),
        tasksCompleted: taskProgress?.completedTasks || 0,
      });
      console.log("[StudySession] Profile stats updated");
    } catch (err: any) {
      console.error("[StudySession] Failed to update stats:", err);
    }

    // Perfect-focus XP is awarded server-side by the signal-processing service.

    let kpSessionResult = null;
    if (completedStudySessionId) {
      try {
        kpSessionResult = await gamificationAPI.getRankSessionResult(
          completedStudySessionId,
        );
      } catch (err: any) {
        console.error("[StudySession] Failed to fetch KP session result:", err);
      }
    }

    // Clean up refs
    studySessionIdRef.current = null;
    focusSessionIdRef.current = null;

    // If task-progression mode, transition to summary screen
    if (hasTaskProgression) {
      finishSession({
        kpResult: kpSessionResult,
        completionRewards,
        alreadyCompleted: true,
      });
    }
  };

  // Fetch current signals (focus/fatigue)
  const fetchSignals = async () => {
    try {
      const response = await aiAPI.getCurrentSignals(user._id);
      setSignals(response.data);

      // Add to history for charting
      setSignalHistory((prev: any) => [
        ...prev.slice(-50),
        {
          timestamp: new Date(response.data.timestamp),
          focus: response.data.focus.score,
          fatigue: response.data.fatigue.score,
        },
      ]);
    } catch (error: any) {
      console.error("Failed to fetch signals:", error);
    }
  };

  // Request coach decision
  const requestCoachDecision = async () => {
    try {
      const response = await aiAPI.getCoachDecision({
        user_id: user._id,
        ignored_count: ignoredCount,
        do_not_disturb: doNotDisturb,
        focus_score: signals?.focus?.score,
        focus_state: signals?.focus?.state,
        fatigue_score: signals?.fatigue?.score,
        fatigue_state: signals?.fatigue?.state,
      });
      const decision = response.data.coach_action;
      setCoachDecision(decision);

      // Show coach popup if action is not silence
      if (decision.action_type !== "silence") {
        setCoachVisible(true);
      }
    } catch (error: any) {
      console.error("Failed to get coach decision:", error);
    }
  };

  // Handle coach actions
  const acceptCoachSuggestion = () => {
    setCoachVisible(false);
    setIgnoredCount(0);

    // Implement the suggestion (e.g., take break)
    if (coachDecision?.action_type === "suggest_break") {
      stopSession();
    }
  };
  const ignoreCoachSuggestion = () => {
    setCoachVisible(false);
    setIgnoredCount((prev: any) => prev + 1);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      if (signalPollingRef.current) clearInterval(signalPollingRef.current);
      if (coachPollingRef.current) clearInterval(coachPollingRef.current);
    };
  }, []);

  // Format duration as HH:MM:SS
  const formatDuration = (seconds: any) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  const formatShortDuration = (seconds: any) => {
    const safe = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get state badge class
  const getStateBadgeClass = (state: any) => {
    const stateMap: Record<string, string> = {
      Focused: "badge-success",
      Drifting: "badge-warning",
      Lost: "badge-danger",
      Alert: "badge-success",
      Moderate: "badge-info",
      High: "badge-warning",
      Critical: "badge-danger",
    };
    return stateMap[state] || "badge-default";
  };

  // ─── Summary Screen ────────────────────────────────────────────────
  if (step === "summary" && sessionSummary) {
    return (
      <>
        <SessionSummary
          summary={sessionSummary}
          onRestart={() => {
            resetSession();
            navigate("/session-setup");
          }}
          onGoHome={() => {
            resetSession();
            navigate("/dashboard");
          }}
        />
      </>
    );
  }

  // ─── Task-by-Task Progression Mode ─────────────────────────────────
  if (hasTaskProgression) {
    const currentIdx = taskProgress.currentTaskIndex || 0;
    const current = taskProgress.tasks[currentIdx];
    const allDone = taskProgress.completedTasks >= taskProgress.totalTasks;
    const estimatedMinutes =
      Number(current?.estimatedMinutes) > 0
        ? Number(current.estimatedMinutes)
        : 30;
    const minRequiredSeconds = Math.floor(estimatedMinutes * 60 * 0.8);
    const taskStartedAtMs = current?.startedAt
      ? new Date(current.startedAt).getTime()
      : null;
    const elapsedTaskSeconds = taskStartedAtMs
      ? Math.max(0, Math.floor((Date.now() - taskStartedAtMs) / 1000))
      : 0;
    const canAdvanceTask =
      BYPASS_TASK_TIMING_GATE || elapsedTaskSeconds >= minRequiredSeconds;
    const remainingAdvanceSeconds = Math.max(
      0,
      minRequiredSeconds - elapsedTaskSeconds,
    );
    const advanceProgressPct = BYPASS_TASK_TIMING_GATE
      ? 100
      : Math.min(
          100,
          Math.round(
            (elapsedTaskSeconds / Math.max(minRequiredSeconds, 1)) * 100,
          ),
        );
    return (
      <div className="min-h-screen bg-[#0f1923] text-white relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a2633] via-[#0f1923] to-[#0f1923] z-0" />

        <div className="relative z-10">
          {/* Top header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-[#ffffff10] bg-[#0f1923]/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  stopSession();
                  resetSession();
                  navigate("/session-setup");
                }}
                className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <BookOpen
                size={18}
                className="text-[var(--accent-color-dynamic)]"
              />
              <span className="font-bold tracking-wider uppercase text-sm">
                {selectedCourse?.title || "Study Session"}
              </span>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-gray-400">
                <Clock size={16} />
                <span className="font-mono font-bold text-lg">
                  {formatDuration(sessionDuration)}
                </span>
              </div>

              {activeSession?.xpMultiplier > 1 && (
                <div className="flex items-center gap-1 text-[var(--accent-color-dynamic)]">
                  <Zap size={14} />
                  <span className="font-bold text-sm">
                    {activeSession.xpMultiplier}x XP
                  </span>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={doNotDisturb}
                  onChange={(e: any) => setDoNotDisturb(e.target.checked)}
                  className="rounded"
                />
                DND
              </label>
              <button
                onClick={() => stopSession()}
                className="px-4 py-2 bg-[var(--accent-color-dynamic)] text-white text-xs font-bold tracking-wider uppercase rounded hover:bg-[var(--accent-color-dynamic-hover)] transition-colors"
              >
                END SESSION
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="max-w-5xl mx-auto p-6">
            <TaskProgressBar taskProgress={taskProgress} />

            {!allDone && current && (
              <motion.div
                key={currentIdx}
                initial={{
                  opacity: 0,
                  x: 30,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Task Content */}
                <div className="lg:col-span-2">
                  <div className="bg-[#1a2633] border border-[#ffffff10] rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent-color-dynamic)] to-transparent" />

                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-[var(--accent-color-dynamic)]/10 text-[var(--accent-color-dynamic)] text-xs font-bold rounded-full uppercase tracking-wider">
                        Task {currentIdx + 1} of {taskProgress.totalTasks}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Target size={12} /> In Progress
                      </span>
                    </div>

                    <h2 className="text-2xl font-black tracking-tight mb-3">
                      {current.title}
                    </h2>
                    {current.description && (
                      <p className="text-gray-400 leading-relaxed mb-6 whitespace-pre-wrap">
                        {current.description}
                      </p>
                    )}

                    <div className="rounded-xl border border-[#ffffff10] bg-[#0f1923] p-4">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-gray-500 uppercase tracking-wider">
                          Task time gate
                        </span>
                        <span className="font-bold text-gray-300">
                          {advanceProgressPct}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#1a2633] rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${canAdvanceTask ? "bg-[var(--accent-color-dynamic)]" : "bg-[var(--accent-color-dynamic)]"}`}
                          style={{
                            width: `${advanceProgressPct}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        {BYPASS_TASK_TIMING_GATE
                          ? "Task timing gate bypassed for development."
                          : canAdvanceTask
                            ? "You can now complete or skip this task."
                            : `You can complete/skip after ${formatShortDuration(remainingAdvanceSeconds)} (80% of ${estimatedMinutes} min).`}
                      </p>
                    </div>

                    <div className="flex gap-3 mt-6 pt-4 border-t border-[#ffffff10]">
                      <button
                        onClick={handleTaskComplete}
                        disabled={taskLoading || !canAdvanceTask}
                        className="flex-1 px-6 py-3 bg-[var(--accent-color-dynamic)] text-white font-bold tracking-wider uppercase rounded-lg hover:bg-[var(--accent-color-dynamic)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 size={18} />{" "}
                        {taskLoading ? "..." : "MARK COMPLETE"}
                      </button>
                      <button
                        onClick={skipTask}
                        disabled={taskLoading || !canAdvanceTask}
                        className="px-6 py-3 bg-[#1a2633] border border-[#ffffff10] text-gray-400 font-bold tracking-wider uppercase rounded-lg hover:bg-[#ffffff10] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <SkipForward size={18} /> SKIP
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  {isTeamSession && liveTeamSessionId && (
                    <>
                      <TeamSessionPanel
                        sessionId={liveTeamSessionId}
                        isHost={isTeamHost}
                        inviteCode={inviteCode || activeSession?.inviteCode}
                        showActions={false}
                      />
                      {user?._id && (
                        <VoiceButton
                          sessionId={liveTeamSessionId}
                          userId={user._id}
                        />
                      )}
                    </>
                  )}

                  {sessionActive && (
                    <div className="bg-[#1a2633] border border-[#ffffff10] rounded-xl p-4">
                      <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-3">
                        Focus Monitoring
                      </h3>
                      <WebcamCapture
                        onFrameCapture={handleFrameCapture}
                        captureInterval={3000}
                        enabled={sessionActive}
                      />
                    </div>
                  )}

                  {signals && (
                    <div className="bg-[#1a2633] border border-[#ffffff10] rounded-xl p-4 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Focus</span>
                          <span
                            className={`font-bold ${signals.focus.score > 0.6 ? "text-[var(--accent-color-dynamic)]" : signals.focus.score > 0.3 ? "text-[var(--accent-color-dynamic)]" : "text-[var(--accent-color-dynamic)]"}`}
                          >
                            {(signals.focus.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#0f1923] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent-color-dynamic)] rounded-full transition-all duration-500"
                            style={{
                              width: `${signals.focus.score * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Fatigue</span>
                          <span
                            className={`font-bold ${signals.fatigue.score < 0.3 ? "text-[var(--accent-color-dynamic)]" : signals.fatigue.score < 0.6 ? "text-[var(--accent-color-dynamic)]" : "text-[var(--accent-color-dynamic)]"}`}
                          >
                            {(signals.fatigue.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#0f1923] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent-color-dynamic)] rounded-full transition-all duration-500"
                            style={{
                              width: `${signals.fatigue.score * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task list sidebar */}
                  <div className="bg-[#1a2633] border border-[#ffffff10] rounded-xl p-4">
                    <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-3">
                      Task List
                    </h3>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {taskProgress.tasks.map((task: any, idx: any) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${idx === currentIdx ? "bg-[var(--accent-color-dynamic)]/10 text-white" : task.status === "completed" ? "text-[var(--accent-color-dynamic)]" : task.status === "skipped" ? "text-[var(--accent-color-dynamic)]" : "text-gray-600"}`}
                        >
                          {task.status === "completed" ? (
                            <CheckCircle2 size={12} />
                          ) : task.status === "skipped" ? (
                            <SkipForward size={12} />
                          ) : idx === currentIdx ? (
                            <Play
                              size={12}
                              className="text-[var(--accent-color-dynamic)]"
                            />
                          ) : (
                            <div className="w-3 h-3 rounded-full border border-gray-600" />
                          )}
                          <span className="truncate">{task.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {showSocratic && socraticTask && (
                    <SocraticEvaluation
                      taskTitle={socraticTask.title}
                      taskDescription={socraticTask.description}
                      taskDetails={socraticTask.details}
                      maxAttempts={3}
                      onClose={() => {
                        setShowSocratic(false);
                        setSocraticTask(null);
                      }}
                    />
                  )}

                  {sessionActive && (
                    <ChatWindow
                      sessionId={
                        activeSession?._id || studySessionIdRef.current
                      }
                      userId={user?._id}
                    />
                  )}
                </div>
              </motion.div>
            )}

            {/* All tasks complete prompt */}
            {allDone && (
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.95,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                className="text-center py-20"
              >
                <Trophy
                  size={64}
                  className="mx-auto text-[var(--accent-color-dynamic)] mb-4"
                />
                <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">
                  ALL TASKS COMPLETE!
                </h2>
                <p className="text-gray-400 mb-8">
                  Amazing work! End the session to view your results.
                </p>
                <button
                  onClick={() => stopSession()}
                  className="px-12 py-4 bg-[var(--accent-color-dynamic)] text-white font-black text-xl tracking-widest uppercase hover:bg-[var(--accent-color-dynamic-hover)] transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_var(--accent-color-dynamic-shadow-40)]"
                >
                  VIEW RESULTS
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Coach Popup (task mode) */}
        {coachVisible && coachDecision && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <motion.div
              initial={{
                scale: 0.9,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              className="bg-[#1a2633] border border-[#ffffff10] rounded-2xl p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                AI Coach
              </h3>
              <div className="bg-[#0f1923] rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--accent-color-dynamic)] uppercase tracking-wider inline-block mb-3">
                {coachDecision.action_type.replace("_", " ")}
              </div>
              {coachDecision.message && (
                <p className="text-gray-300 mb-3">{coachDecision.message}</p>
              )}
              <p className="text-gray-500 text-sm mb-4">
                {coachDecision.reasoning}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={acceptCoachSuggestion}
                  className="flex-1 px-4 py-2 bg-[var(--accent-color-dynamic)] text-white rounded-lg font-bold"
                >
                  Accept
                </button>
                <button
                  onClick={ignoreCoachSuggestion}
                  className="flex-1 px-4 py-2 bg-[#1a2633] border border-[#ffffff10] text-gray-400 rounded-lg font-bold"
                >
                  Ignore
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // ─── Original Mode (no task progression — direct session start) ────
  return (
    <div className="study-session-container">
      <h1>Live Study Session</h1>
      <p className="subtitle">
        AI-powered coaching with real-time focus and fatigue monitoring
      </p>

      {/* Session Controls */}
      <div className="session-controls">
        <button
          onClick={toggleSession}
          className={`session-btn ${sessionActive ? "session-active" : ""}`}
        >
          {sessionActive ? "End Session" : "Start Study Session"}
        </button>

        {sessionActive && (
          <div className="session-stats">
            <div className="stat">
              <span className="stat-label">Session Time</span>
              <span className="stat-value">
                {formatDuration(sessionDuration)}
              </span>
            </div>
            <div className="stat">
              <label className="dnd-toggle">
                <input
                  type="checkbox"
                  checked={doNotDisturb}
                  onChange={(e: any) => setDoNotDisturb(e.target.checked)}
                />
                Do Not Disturb
              </label>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginBottom: "12px",
        }}
      ></div>

      {sessionActive && isTeamSession && liveTeamSessionId && (
        <div
          className="webcam-section"
          style={{
            textAlign: "left",
          }}
        >
          <TeamSessionPanel
            sessionId={liveTeamSessionId}
            isHost={isTeamHost}
            inviteCode={inviteCode || activeSession?.inviteCode}
            showActions={false}
          />
          {user?._id && (
            <div
              style={{
                marginTop: "12px",
              }}
            >
              <VoiceButton sessionId={liveTeamSessionId} userId={user._id} />
            </div>
          )}
        </div>
      )}

      {/* Webcam Monitoring */}
      {sessionActive && (
        <div className="webcam-section">
          <h3>📹 Live Monitoring</h3>
          <WebcamCapture
            onFrameCapture={handleFrameCapture}
            captureInterval={3000}
            enabled={sessionActive}
          />
          <p className="webcam-note">
            Your camera is being used to detect focus and fatigue levels. Data
            is processed locally and not stored.
          </p>
        </div>
      )}

      {/* Signal Dashboard */}
      {sessionActive && signals && (
        <div className="signals-dashboard">
          <div className="signal-card focus-signal">
            <h3>Focus State</h3>
            <div className="signal-content">
              <div className="signal-gauge">
                <div
                  className="gauge-fill focus-gauge"
                  style={{
                    width: `${signals.focus.score * 100}%`,
                  }}
                ></div>
              </div>
              <div className="signal-details">
                <span
                  className={`state-badge ${getStateBadgeClass(signals.focus.state)}`}
                >
                  {signals.focus.state}
                </span>
                <span className="signal-score">
                  {(signals.focus.score * 100).toFixed(0)}%
                </span>
                <span className="signal-confidence">
                  Confidence: {(signals.focus.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="signal-card fatigue-signal">
            <h3>Fatigue Level</h3>
            <div className="signal-content">
              <div className="signal-gauge">
                <div
                  className="gauge-fill fatigue-gauge"
                  style={{
                    width: `${signals.fatigue.score * 100}%`,
                  }}
                ></div>
              </div>
              <div className="signal-details">
                <span
                  className={`state-badge ${getStateBadgeClass(signals.fatigue.state)}`}
                >
                  {signals.fatigue.state}
                </span>
                <span className="signal-score">
                  {(signals.fatigue.score * 100).toFixed(0)}%
                </span>
                <span className="signal-confidence">
                  Confidence: {(signals.fatigue.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Break Detection Status */}
      {sessionActive && (
        <div
          className="signals-dashboard"
          style={{
            marginTop: "16px",
          }}
        >
          <div
            className={`signal-card ${isOnBreak ? "fatigue-signal" : "focus-signal"}`}
          >
            <h3>☕ Break Detection</h3>
            <div className="signal-content">
              <div
                className="signal-details"
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className={`state-badge ${isOnBreak ? "badge-danger" : "badge-success"}`}
                >
                  {isOnBreak ? "🔴 On Break" : "🟢 Studying"}
                </span>
                <span className="signal-score">Breaks: {breakCount}</span>
                {isOnBreak && (
                  <span className="signal-confidence">
                    Break duration:{" "}
                    {formatDuration(Math.floor(currentBreakDuration))}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signal History Chart */}
      {sessionActive && signalHistory.length > 0 && (
        <div className="signal-history">
          <h3>Signal History</h3>
          <div className="history-chart">
            {signalHistory.map((point: any, idx: any) => (
              <div key={idx} className="chart-bar">
                <div
                  className="bar-focus"
                  style={{
                    height: `${point.focus * 100}%`,
                  }}
                  title={`Focus: ${(point.focus * 100).toFixed(0)}%`}
                ></div>
                <div
                  className="bar-fatigue"
                  style={{
                    height: `${point.fatigue * 100}%`,
                  }}
                  title={`Fatigue: ${(point.fatigue * 100).toFixed(0)}%`}
                ></div>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-color focus-color"></span> Focus
            </span>
            <span className="legend-item">
              <span className="legend-color fatigue-color"></span> Fatigue
            </span>
          </div>
        </div>
      )}

      {sessionActive && (
        <div
          style={{
            marginTop: "16px",
          }}
        >
          <ChatWindow
            sessionId={activeSession?._id || studySessionIdRef.current}
            userId={user?._id}
          />
        </div>
      )}

      {/* Coach Popup */}
      {coachVisible && coachDecision && (
        <div className="coach-overlay">
          <div className="coach-popup">
            <div className="coach-header">
              <h3>🤖 AI Coach Recommendation</h3>
              <button onClick={ignoreCoachSuggestion} className="close-btn">
                ×
              </button>
            </div>

            <div className="coach-body">
              <div className="coach-action-type">
                {coachDecision.action_type.replace("_", " ").toUpperCase()}
              </div>

              {coachDecision.message && (
                <p className="coach-message">{coachDecision.message}</p>
              )}

              <div className="coach-reasoning">
                <strong>Reasoning:</strong> {coachDecision.reasoning}
              </div>
            </div>

            <div className="coach-actions">
              <button onClick={acceptCoachSuggestion} className="accept-btn">
                Accept
              </button>
              <button onClick={ignoreCoachSuggestion} className="ignore-btn">
                Ignore
              </button>
            </div>

            {ignoredCount > 0 && (
              <div className="ignored-count">
                You've ignored {ignoredCount} suggestion(s) recently
              </div>
            )}
          </div>
        </div>
      )}

      {/* Socratic Evaluation Button (original mode) */}
      {sessionActive && !showSocratic && (
        <div
          style={{
            marginTop: "12px",
          }}
        >
          <button
            onClick={() => {
              setSocraticTask({
                title: "Current Study Topic",
                description: "Review your understanding of the material",
                details: "General session knowledge check",
              });
              setShowSocratic(true);
            }}
            className="w-full px-4 py-2 bg-[#1a2633] border border-[#ffffff10] text-gray-300 text-xs font-bold tracking-wider uppercase rounded-lg hover:bg-[#ffffff10] transition-all flex items-center justify-center gap-2"
          >
            <Brain size={14} /> Socratic Evaluation
          </button>
        </div>
      )}

      {/* Info Section */}
      {!sessionActive && (
        <div className="session-info">
          <h2>How It Works</h2>
          <div className="info-grid">
            <div className="info-card">
              <span className="info-icon">🎯</span>
              <h4>Focus Detection</h4>
              <p>AI monitors your focus state in real-time using ML models</p>
            </div>
            <div className="info-card">
              <span className="info-icon">😴</span>
              <h4>Fatigue Monitoring</h4>
              <p>
                Detects signs of fatigue to prevent burnout and optimize
                learning
              </p>
            </div>
            <div className="info-card">
              <span className="info-icon">🤖</span>
              <h4>Smart Coaching</h4>
              <p>Personalized recommendations based on your current state</p>
            </div>
            <div className="info-card">
              <span className="info-icon">📅</span>
              <h4>Adaptive Scheduling</h4>
              <p>Automatically adjusts your study plan based on progress</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StudySession;
