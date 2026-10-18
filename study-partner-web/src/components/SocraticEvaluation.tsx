import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, CheckCircle2, XCircle, Brain, RefreshCw } from "lucide-react";
import { aiAPI } from "../services/api";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90000;

function createSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function SocraticEvaluation({
  taskTitle,
  taskDescription,
  taskDetails,
  maxAttempts = 5,
  onComplete,
  onClose,
}: any) {
  const containerRef = useRef<any>(null);
  const sessionIdRef = useRef(createSessionId());
  const stepRef = useRef(1);
  const pollRef = useRef<any>(null);
  const aliveRef = useRef(true);

  const [question, setQuestion] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [state, setState] = useState("idle");
  const [masteryScore, setMasteryScore] = useState(0);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [error, setError] = useState<any>(null);
  const [answerError, setAnswerError] = useState<any>(null);

  const reset = useCallback(() => {
    aliveRef.current = false;
    clearTimeout(pollRef.current);
    sessionIdRef.current = createSessionId();
    stepRef.current = 1;
    aliveRef.current = true;
    setMasteryScore(0);
    setQuestionsAsked(0);
    setFeedback(null);
    setUserAnswer("");
    setError(null);
    setAnswerError(null);
    setQuestion(taskTitle || taskDescription || "Explain your understanding of this task.");
    setState("answering");
  }, [taskTitle, taskDescription]);

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  useEffect(() => {
    const prompt = taskTitle || taskDescription || "Explain your understanding of this task.";
    setQuestion(prompt);
    setState("answering");
  }, [taskTitle, taskDescription]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimeout(pollRef.current);
    };
  }, []);

  const pollEvalJob = useCallback((jobId: any) => {
    return new Promise((resolve: any, reject: any) => {
      const startedAt = Date.now();
      const tick = async () => {
        if (!aliveRef.current) return reject(new Error("cancelled"));
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          return reject(new Error("Evaluation timed out"));
        }
        try {
          const res = await aiAPI.getEvalJob(jobId);
          const job = res.data;
          if (job.status === "COMPLETED") return resolve(job.result);
          if (job.status === "FAILED") {
            return reject(new Error(job.error || "Evaluation failed"));
          }
          pollRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        } catch (err: any) {
          if (!aliveRef.current) return reject(new Error("cancelled"));
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            return reject(new Error("Evaluation timed out"));
          }
          pollRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        }
      };
      pollRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    });
  }, []);

  const applyResult = useCallback(
    (result: any) => {
      const newState = result?.state ?? result?.evaluation_state;
      const score = result?.mastery_score ?? 0;
      const fb = result?.feedback ?? "";
      const nextQ = result?.next_question ?? "";
      const questions = questionsAsked + 1;

      setFeedback(fb);
      setMasteryScore(score);
      setQuestionsAsked(questions);

      if (newState === "mastery_confirmed" || newState === "failed") {
        setState("complete");
        onComplete?.({
          state: newState,
          mastery_score: score,
          questions_asked: questions,
          feedback: fb,
        });
      } else {
        stepRef.current += 1;
        setQuestion(nextQ || "Explain your understanding further.");
        setUserAnswer("");
        setState("answering");
      }
    },
    [questionsAsked, onComplete],
  );

  const submitAnswer = useCallback(async () => {
    const answer = userAnswer.trim();
    if (!aliveRef.current) return;
    if (!answer) {
      setAnswerError("Please enter your answer before submitting.");
      return;
    }
    setAnswerError(null);
    setState("submitting");
    setError(null);
    try {
      const res = await aiAPI.submitEvalStep({
        sessionId: sessionIdRef.current,
        step: stepRef.current,
        contextId: taskTitle || taskDescription || "socratic-eval",
        studentAnswer: answer,
        maxAttempts,
        taskDescription: taskDescription || undefined,
        taskDetails: taskDetails || undefined,
      });
      setState("polling");
      const result = await pollEvalJob(res.data.jobId);
      if (aliveRef.current) applyResult(result);
    } catch (err: any) {
      if (!aliveRef.current) return;
      setError(err.response?.data?.error || err.message || "Failed to submit answer");
      setState("error");
    }
  }, [userAnswer, taskTitle, taskDescription, taskDetails, maxAttempts, pollEvalJob, applyResult]);

  if (state === "idle") {
    return (
      <div ref={containerRef} className="bg-[#1a2633] border border-[var(--accent-color-dynamic)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={18} className="text-[var(--accent-color-dynamic)]" />
          <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase">
            Socratic Evaluation
          </h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Test your understanding with AI-driven Socratic questioning.
        </p>
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 size={20} className="animate-spin text-[var(--accent-color-dynamic)]" />
          <span className="text-sm text-gray-400">Starting evaluation...</span>
        </div>
      </div>
    );
  }

  if (state === "submitting" || state === "polling") {
    return (
      <div className="bg-[#1a2633] border border-[#ffffff10] rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 size={20} className="animate-spin text-[var(--accent-color-dynamic)]" />
          <span className="text-sm text-gray-400">
            {state === "submitting" ? "Submitting answer..." : "Analyzing your answer..."}
          </span>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-[#1a2633] border border-[#ffffff10] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <XCircle size={16} className="text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-[var(--accent-color-dynamic)] hover:underline"
        >
          <RefreshCw size={12} /> Try Again
        </button>
      </div>
    );
  }

  if (state === "complete") {
    const isSuccess = masteryScore >= 0.7;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a2633] border border-[#ffffff10] rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          {isSuccess ? (
            <CheckCircle2 size={18} className="text-green-400" />
          ) : (
            <XCircle size={18} className="text-red-400" />
          )}
          <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase">
            Evaluation {isSuccess ? "Passed" : "Needs Review"}
          </h3>
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Mastery Score</span>
            <span className={`font-bold ${isSuccess ? "text-green-400" : "text-red-400"}`}>
              {Math.round(masteryScore * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-[#0f1923] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isSuccess ? "bg-green-400" : "bg-red-400"}`}
              style={{ width: `${masteryScore * 100}%` }}
            />
          </div>
        </div>
        {feedback && (
          <p className="text-xs text-gray-300 mb-3">{feedback}</p>
        )}
        <p className="text-xs text-gray-500 mb-3">
          Questions answered: {questionsAsked}
        </p>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 px-3 py-2 bg-[var(--accent-color-dynamic)] text-white text-xs font-bold tracking-wider uppercase rounded-lg hover:opacity-90 transition-all"
          >
            Retry
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-[#0f1923] border border-[#ffffff10] text-gray-400 text-xs font-bold tracking-wider uppercase rounded-lg hover:bg-[#ffffff10] transition-all"
            >
              Close
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1a2633] border border-[#ffffff10] rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[var(--accent-color-dynamic)]" />
          <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase">
            Socratic Q&A
          </h3>
        </div>
        <span className="text-xs text-gray-500">
          Q{questionsAsked + 1}
        </span>
      </div>

      <div className="bg-[#0f1923] rounded-lg p-3 mb-3">
        <p className="text-sm text-white leading-relaxed">{question}</p>
      </div>

      <textarea
        value={userAnswer}
        onChange={(e: any) => {
          setUserAnswer(e.target.value);
          if (answerError) setAnswerError(null);
        }}
        placeholder="Type your answer..."
        rows={3}
        className="w-full bg-[#0f1923] border border-[#ffffff10] rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[var(--accent-color-dynamic)] transition-colors mb-3"
        onKeyDown={(e: any) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitAnswer();
          }
        }}
      />

      <button
        onClick={submitAnswer}
        className="w-full px-4 py-2 bg-[var(--accent-color-dynamic)] text-white text-xs font-bold tracking-wider uppercase rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
      >
        <Send size={14} /> Submit Answer
      </button>

      {answerError && (
        <p className="text-xs text-red-400 mt-2">{answerError}</p>
      )}

      {feedback && (
        <p className="text-xs text-gray-400 mt-2">{feedback}</p>
      )}
    </motion.div>
  );
}