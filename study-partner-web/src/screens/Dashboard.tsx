'use client';
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "@/navigation";
import { profileAPI, tasksAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import QuestPanel from "../components/QuestPanel";

const Dashboard = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showPendingTasks, setShowPendingTasks] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [profileRes, tasksRes, statsRes] = await Promise.all([
        profileAPI.get().catch((err: any) => {
          if (err.response?.status === 404) {
            return { data: { profile: null } };
          }
          throw err;
        }),
        tasksAPI.getAll().catch((err: any) => {
          if (err.response?.status === 404) {
            return { data: { tasks: [] } };
          }
          throw err;
        }),
        profileAPI.getStats().catch(() => ({ data: {} })),
      ]);

      const pendingTasks = (tasksRes.data.tasks || []).filter(
        (task: any) => task.status === "todo" || task.status === "in-progress",
      );

      setProfile(profileRes.data.profile);
      setStats(statsRes.data?.stats || statsRes.data || {});
      setTasks(pendingTasks);
      setError("");
    } catch (err: any) {
      const status = err.response?.status;
      if (status !== 404) {
        setError(
          `Failed to load dashboard - ${status === 401 ? "Please log in again" : "Server error"}`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background relative overflow-hidden">
      <header className="mb-6 px-6 pt-4">
        <h1 className="text-2xl font-bold">Your study dashboard</h1>
        <p className="text-muted-foreground">Choose a subject or start a focused study session.</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link to="/session-setup" className="px-4 py-2 rounded bg-primary text-primary-foreground font-semibold">Start studying</Link>
          <Link to="/subjects" className="px-4 py-2 rounded border border-border">Add a subject</Link>
        </div>
      </header>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center relative z-10"
        >
          <div className="relative w-32 h-32 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-foreground text-xl font-bold tracking-wider">
            LOADING...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-foreground relative overflow-hidden transition-colors duration-300">
      {/* Content wrapper */}
      <div className="relative z-10 pt-4 pb-12">
        {/* Header with theme-aware design */}

        <div className="max-w-7xl mx-auto px-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-destructive/10 border-l-4 border-destructive text-destructive font-medium"
            >
              {error}
            </motion.div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="STUDY TIME"
              value={`${Math.floor((stats?.totalStudyTime || 0) / 60)}H`}
              subtitle={`${(stats?.totalStudyTime || 0) % 60}M`}
              icon="⏱"
            />
            <StatCard
              title="TASKS DONE"
              value={stats?.completedTasks || 0}
              subtitle="COMPLETED"
              icon="✓"
            />
            <StatCard
              title="STREAK"
              value={`${stats?.currentStreak || 0}`}
              subtitle="DAYS"
              icon="🔥"
            />
            <StatCard
              title="PENDING"
              value={tasks.length}
              subtitle="TASKS"
              icon="📋"
              clickable
              onClick={() => setShowPendingTasks((prev: any) => !prev)}
            />
          </div>

          {showPendingTasks && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 card-valorant p-6 bg-card/80 backdrop-blur-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold tracking-wider text-foreground">
                  <span className="text-primary">{"//"}</span> PENDING TASKS
                </h2>
                <Link
                  to="/tasks"
                  className="px-4 py-2 bg-muted hover:bg-muted/80 transition-colors text-sm font-bold tracking-wider border border-border text-foreground"
                >
                  VIEW ALL
                </Link>
              </div>

              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-lg mb-2">NO PENDING TASKS</p>
                    <Link
                      to="/tasks"
                      className="text-primary hover:underline font-semibold"
                    >
                      Create your first task
                    </Link>
                  </div>
                ) : (
                  tasks.slice(0, 6).map((task) => (
                    <div
                      key={task._id}
                      className="bg-background/50 border-l-4 border-primary p-4 hover:bg-accent/50 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base text-foreground truncate">
                            {task.title}
                          </h3>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="uppercase">
                              {task.status || "todo"}
                            </span>
                            {task.priority && (
                              <span className="uppercase">{task.priority}</span>
                            )}
                            {task.estimatedTime && (
                              <span>{task.estimatedTime} min</span>
                            )}
                          </div>
                        </div>
                        <Link
                          to={`/session-setup?taskId=${task._id}`}
                          className="px-3 py-2 bg-primary text-primary-foreground rounded font-semibold text-xs tracking-wide hover:opacity-90 transition-opacity"
                        >
                          PLAY
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quest Panel - Left */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <QuestPanel />
            </motion.div>

            {/* Profile & Quick Actions - Right */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* Profile Card */}
              <div className="card-valorant p-6 relative overflow-hidden bg-card/80 backdrop-blur-md border border-border/50">
                <div className="card-inner-sheen" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent"></div>

                <h2 className="text-xl font-bold tracking-wider mb-4 text-foreground relative z-10">
                  <span className="text-primary">{"//"}</span> PROFILE
                </h2>

                <div className="space-y-3 text-sm relative z-10">
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-muted-foreground">EMAIL</span>
                    <span className="font-semibold text-xs text-foreground">
                      {user?.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-muted-foreground">ROLE</span>
                    <span
                      className={`font-bold ${user?.role === "admin" ? "text-primary" : "text-[var(--accent-color-dynamic)]"}`}
                    >
                      {user?.role?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-muted-foreground">THEME</span>
                    <span className="font-semibold text-foreground">
                      {profile?.preferences?.theme?.toUpperCase() || "DARK"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">STUDY TIME</span>
                    <span className="font-semibold text-foreground">
                      {profile?.preferences?.studyTime?.toUpperCase() ||
                        "EVENING"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card-valorant p-6 relative overflow-hidden bg-card/80 backdrop-blur-md border border-border/50">
                <div className="card-inner-sheen" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent"></div>

                <h2 className="text-xl font-bold tracking-wider mb-4 text-foreground relative z-10">
                  <span className="text-primary">{"//"}</span> QUICK ACTIONS
                </h2>

                <div className="space-y-3 relative z-10">
                  <Link
                    to="/tasks"
                    className="block px-4 py-3 bg-muted/30 hover:bg-primary transition-all duration-300 font-bold tracking-wider text-center border border-border hover:border-primary text-foreground hover:text-white group"
                  >
                    <span className="group-hover:scale-110 inline-block transition-transform mr-2">
                      ➕
                    </span>{" "}
                    CREATE TASK
                  </Link>
                  <Link
                    to="/session-setup"
                    className="block px-4 py-3 bg-[var(--accent-color-dynamic)] text-white hover:brightness-110 transition-all duration-300 font-bold tracking-wider text-center shadow-lg group"
                  >
                    <span className="group-hover:scale-110 inline-block transition-transform mr-2">
                      🚀
                    </span>{" "}
                    PLAY (STUDY)
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Theme-aware StatCard
const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  onClick,
  clickable = false,
}: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="card-valorant p-6 relative overflow-hidden group border border-border hover:border-primary transition-all duration-300 bg-card/80 backdrop-blur-md"
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (event: any) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="card-inner-sheen" />
      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-border group-hover:border-primary transition-colors"></div>

      {/* Icon */}
      <div className="text-4xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity text-foreground">
        {icon}
      </div>

      {/* Stats */}
      <div className="text-3xl font-bold text-foreground mb-1 tracking-wider relative z-10">
        {value}
      </div>
      <div className="text-sm text-muted-foreground font-semibold tracking-wider relative z-10">
        {subtitle || title}
      </div>

      {/* Title */}
      <div className="absolute top-3 right-3 text-xs text-muted-foreground font-bold tracking-wider">
        {title}
      </div>

      {/* Hover accent line */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </motion.div>
  );
};

export default Dashboard;
