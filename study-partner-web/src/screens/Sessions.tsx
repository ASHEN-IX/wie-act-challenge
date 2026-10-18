'use client';
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "@/navigation";
import { sessionsAPI, tasksAPI } from "../services/api";
const Sessions = () => {
  const location = useLocation();
  const [sessions, setSessions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [timer, setTimer] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    taskId: "",
    notes: "",
  });
  useEffect(() => {
    fetchData();
    // Auto-open modal or start if coming from Lobby
    if (location.state?.mode) {
      setShowCreateModal(true);
      // Could also pre-fill notes with mode name
      setFormData((prev: any) => ({
        ...prev,
        notes: `Mode: ${location.state.mode.toUpperCase()}`,
      }));
    }
  }, [location.state]);
  useEffect(() => {
    let interval: any = null;
    if (activeSession) {
      interval = setInterval(() => {
        setTimer((prev: any) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);
  const fetchData = async () => {
    try {
      const [sessionsRes, tasksRes] = await Promise.all([
        sessionsAPI.getAll(),
        tasksAPI.getAll({
          status: "in-progress",
        }),
      ]);
      const allSessions = sessionsRes.data.sessions || [];
      setSessions(allSessions);
      setTasks(tasksRes.data.tasks || []);

      // Check for active session to restore state
      const active = allSessions.find((s: any) => s.status === "active");
      if (active) {
        setActiveSession(active);
        const elapsed = Math.floor(
          ((new Date() as any) - (new Date(active.startTime) as any)) / 1000,
        );
        setTimer(elapsed > 0 ? elapsed : 0);
      }
    } catch (error: any) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };
  const startSession = async () => {
    try {
      const payload: any = {
        status: "active",
      };
      if (formData.taskId) {
        payload.taskId = formData.taskId;
      }
      if (formData.notes) {
        payload.notes = formData.notes;
      }
      const response = await sessionsAPI.create(payload);
      // Backend returns the session object directly
      setActiveSession(response.data.session || response.data);
      setTimer(0);
      setShowCreateModal(false);
      setFormData({
        taskId: "",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      console.error("Failed to start session:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "Unknown error";
      alert(`Failed to start session: ${errorMessage}`);
    }
  };
  const endSession = async () => {
    if (!activeSession) return;
    try {
      await sessionsAPI.endSession(activeSession._id);
      setActiveSession(null);
      setTimer(0);
      fetchData();
    } catch (error: any) {
      console.error("Failed to end session:", error);
    }
  };
  const formatTime = (seconds: any) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  const formatDate = (date: any) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-foreground text-xl font-bold tracking-wider">
          LOADING SESSIONS...
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-background via-muted/20 to-background border-b-4 border-primary">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold tracking-wider uppercase">
                <span className="text-primary">{"//"}</span> SESSIONS
              </h1>
              <p className="text-muted-foreground mt-2">
                Track your study sessions
              </p>
            </div>
            {!activeSession && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic-hover)] transition-all duration-300 font-bold tracking-wider"
              >
                + NEW SESSION
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Active Session */}
        {activeSession && (
          <motion.div
            initial={{
              opacity: 0,
              y: -20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="bg-gradient-to-r from-[#1a2633] to-[#0f1923] border-4 border-[var(--accent-color-dynamic)] p-8 mb-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 border-t-4 border-r-4 border-white/10"></div>

            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">
                <span className="text-[var(--accent-color-dynamic)]">
                  {"//"}
                </span>{" "}
                ACTIVE SESSION
              </h2>

              {/* Timer */}
              <div className="text-7xl font-bold tracking-wider mb-6 text-[var(--accent-color-dynamic)]">
                {formatTime(timer)}
              </div>

              {/* Task Info */}
              <p className="text-muted-foreground text-lg mb-8">
                {tasks.find((t) => t._id === activeSession.taskId)?.title ||
                  "General Study"}
              </p>

              {/* Control Buttons */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={endSession}
                  className="px-8 py-4 bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic-hover)] font-bold text-lg tracking-wider transition-all transform hover:scale-105"
                >
                  END SESSION
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Session History */}
        <div className="bg-[#1a2633] border-2 border-[#2e3a4a] p-6">
          <h2 className="text-2xl font-bold mb-6">
            <span className="text-[var(--accent-color-dynamic)]">{"//"}</span>{" "}
            SESSION HISTORY
          </h2>

          {sessions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-xl mb-4">
                NO SESSIONS YET
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic-hover)] font-bold tracking-wider"
              >
                START YOUR FIRST SESSION
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session: any, index: any) => (
                <motion.div
                  key={session._id}
                  initial={{
                    opacity: 0,
                    x: -20,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  transition={{
                    delay: index * 0.1,
                  }}
                  className="bg-card border-l-4 border-primary p-4 hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">
                        {tasks.find((t) => t._id === session.taskId)?.title ||
                          "Study Session"}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>📅 {formatDate(session.startTime)}</span>
                        {session.duration && (
                          <span>
                            ⏱ {Math.floor(session.duration / 60)} minutes
                          </span>
                        )}
                      </div>
                      {session.notes && (
                        <p className="text-muted-foreground text-sm mt-2">
                          {session.notes}
                        </p>
                      )}
                    </div>
                    <div
                      className={`px-4 py-2 text-sm font-bold ${session.endTime ? "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)]" : "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)]"}`}
                    >
                      {session.endTime ? "COMPLETED" : "IN PROGRESS"}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Session Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={(e: any) =>
              e.target === e.currentTarget && setShowCreateModal(false)
            }
          >
            <motion.div
              initial={{
                scale: 0.9,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.9,
                opacity: 0,
              }}
              className="bg-card border-2 border-primary p-8 max-w-md w-full"
            >
              <h2 className="text-3xl font-bold mb-6">
                <span className="text-primary">{"//"}</span> NEW SESSION
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground">
                    SELECT TASK
                  </label>
                  <select
                    value={formData.taskId}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        taskId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-background border-2 border-border focus:border-primary text-foreground outline-none"
                  >
                    <option value="">-- Select a task --</option>
                    {tasks.map((task) => (
                      <option key={task._id} value={task._id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground">
                    NOTES (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-background border-2 border-border focus:border-primary text-foreground outline-none h-24"
                    placeholder="Session notes..."
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={startSession}
                    className="flex-1 px-6 py-3 bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic-hover)] font-bold tracking-wider transition-all"
                  >
                    START SESSION
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({
                        taskId: "",
                        notes: "",
                      });
                    }}
                    className="px-6 py-3 bg-[#2e3a4a] hover:bg-[#3e4a5a] font-bold tracking-wider transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Sessions;
