'use client';
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@/navigation";
import {
  Brain,
  Clock,
  Flame,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { gamificationAPI, profileAPI } from "../services/api";
const MODES = [
  {
    id: "focus",
    name: "DEEP FOCUS",
    role: "Concentration",
    description:
      "Intense distraction-free work blocks for coding, writing, and hard problem solving.",
    features: ["Distraction Shield", "Flow Timing", "Deep Work Boost"],
    icon: Target,
    img: "https://images.unsplash.com/photo-1516110833967-0b5716ca1387?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "pomodoro",
    name: "POMODORO",
    role: "Balance",
    description:
      "Classic focus-break cadence for consistency and sustainable study stamina.",
    features: ["Interval Engine", "Break Recovery", "Momentum Tracking"],
    icon: Clock,
    img: "https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?auto=format&fit=crop&q=80&w=1200",
  },
  {
    id: "exam",
    name: "EXAM PREP",
    role: "Endurance",
    description:
      "Long-form sessions with review checkpoints and high-retention pacing.",
    features: ["Recall Loop", "Review Points", "Pressure Control"],
    icon: Brain,
    img: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=1200",
  },
];
const toSafeCount = (value: any, fallback: any) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.trunc(Number(fallback) || 0));
  }
  return Math.max(0, Math.trunc(parsed));
};
const resolveAssetUrl = (value: any) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("data:")) return value;
  const base = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const path = String(value).startsWith("/") ? value : `/${String(value)}`;
  return `${base}${path}`;
};
const resolveProfileAvatar = (profile: any) => {
  const avatar = profile?.avatar ? String(profile.avatar) : "";
  if (!avatar) {
    const seed = encodeURIComponent(
      String(profile?.nickname || "StudyPartner"),
    );
    return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
  }
  return resolveAssetUrl(avatar);
};
const Lobby = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(MODES[0]);
  const [lockedIn, setLockedIn] = useState(false);
  const [matchState, setMatchState] = useState("selecting");
  const [countdown, setCountdown] = useState(10);
  const [profile, setProfile] = useState<any>(null);
  const [rankProfile, setRankProfile] = useState<any>(null);
  const [rankProgress, setRankProgress] = useState<any>(null);
  const [signals, setSignals] = useState({
    streak: 0,
    tasks: 0,
    groupSessions: 0,
  });
  useEffect(() => {
    const loadLobbyData = async () => {
      try {
        const results = await Promise.allSettled([
          profileAPI.get(),
          gamificationAPI.getProfile(),
          gamificationAPI.getRankProfile(),
        ]);
        const profileResult = results[0];
        const gamificationResult = results[1];
        const rankResult = results[2];
        if (profileResult.status === "fulfilled") {
          setProfile(profileResult.value?.data?.profile || null);
        }
        if (gamificationResult.status === "fulfilled") {
          const gamificationPayload = gamificationResult.value || {};
          const stats =
            gamificationPayload?.stats ||
            gamificationPayload?.data?.stats ||
            {};
          setSignals((prev: any) => ({
            ...prev,
            tasks: toSafeCount(
              stats.tasksCompleted ??
                stats.tasks_completed ??
                stats.challengesCompleted ??
                stats.challenges_completed,
              0,
            ),
            groupSessions: toSafeCount(
              stats.groupSessions ??
                stats.group_sessions ??
                stats.teamSessions ??
                stats.team_sessions,
              0,
            ),
          }));
        }
        if (rankResult.status === "fulfilled") {
          const payload = rankResult.value || {};
          const profileData =
            payload?.profile || payload?.data?.profile || null;
          const progressData =
            payload?.progress || payload?.data?.progress || null;
          setRankProfile(profileData);
          setRankProgress(progressData);
          setSignals((prev: any) => ({
            ...prev,
            streak: toSafeCount(
              profileData?.currentStreak ??
                payload?.currentStreak ??
                prev.streak,
              prev.streak,
            ),
          }));
        }
      } catch (error: any) {
        console.error("Failed to load lobby data:", error);
      }
    };
    loadLobbyData();
  }, []);
  const rankName = String(rankProfile?.rankName || "Unranked");
  const knowledgePoints = toSafeCount(
    rankProfile?.knowledgePoints ?? rankProgress?.currentKp,
    0,
  );
  const nextRankName = String(rankProgress?.nextRank?.name || "MAX");
  const kpToNextRank = toSafeCount(rankProgress?.kpToNextRank, 0);
  const rankProgressPercent = Math.max(
    0,
    Math.min(100, Number(rankProgress?.progressPercent || 0)),
  );
  const handleLockIn = async () => {
    setLockedIn(true);
    setTimeout(() => {
      setMatchState("found");
      let count = 10;
      setCountdown(count);
      const interval = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
          navigate("/sessions", {
            state: {
              mode: selectedMode.id,
            },
          });
        }
      }, 1000);
    }, 1000);
  };
  if (matchState === "found") {
    const SelectedModeIcon = selectedMode.icon;
    const cardImage = resolveProfileAvatar(profile);
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#08101b] flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.22),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.17),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(56,189,248,0.14),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0)_35%)]" />

        <motion.div
          initial={{
            scale: 1.3,
            opacity: 0,
          }}
          animate={{
            scale: 1,
            opacity: 1,
          }}
          className="relative z-10 text-center mb-8"
        >
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
            MATCH FOUND
          </h1>
          <p className="mt-3 text-cyan-300 tracking-[0.28em] text-xs sm:text-sm font-bold">
            {countdown > 0
              ? `SESSION STARTS IN ${countdown}`
              : "SESSION STARTED"}
          </p>
        </motion.div>

        <motion.div
          initial={{
            y: 42,
            opacity: 0,
          }}
          animate={{
            y: 0,
            opacity: 1,
          }}
          transition={{
            delay: 0.2,
          }}
          className="relative z-10 w-[88vw] max-w-md rounded-3xl overflow-hidden border border-white/20 bg-slate-900/65 backdrop-blur-xl shadow-[0_20px_70px_rgba(8,145,178,0.35)]"
        >
          <div
            className="h-52 bg-cover bg-center"
            style={{
              backgroundImage: `url(${cardImage})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
          <div className="relative p-5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider bg-cyan-400/20 text-cyan-200 border border-cyan-300/30">
                {rankName}
              </span>
              <div className="flex items-center gap-2 text-cyan-200/90">
                <SelectedModeIcon size={16} />
                <span className="text-xs font-bold tracking-wide">
                  {selectedMode.name}
                </span>
              </div>
            </div>

            <h2 className="mt-3 text-2xl font-black text-white">
              {String(profile?.nickname || "Agent")}
            </h2>

            <div className="mt-4 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <motion.div
                initial={{
                  width: 0,
                }}
                animate={{
                  width: "100%",
                }}
                transition={{
                  duration: 10,
                  ease: "linear",
                }}
                className="h-full bg-cyan-300"
              />
            </div>
          </div>
          <div className="absolute top-4 left-4">
            <Shield className="w-6 h-6 text-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
          </div>
        </motion.div>
      </div>
    );
  }
  return (
    <div className="min-h-screen relative overflow-hidden text-white">
      <div className="absolute inset-0 bg-[#070d17]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.17),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.16),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(34,197,94,0.14),transparent_40%)]" />
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.2)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <header className="h-20 flex items-center gap-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-cyan-400/15 border border-cyan-300/30 flex items-center justify-center">
            <Swords className="w-5 h-5 text-cyan-200" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-wide">
              SESSION LOBBY
            </h1>
            <p className="text-xs text-slate-300 uppercase tracking-[0.2em]">
              Choose a study mode and launch
            </p>
          </div>
          <div className="ml-auto px-3 py-1 rounded-lg border border-white/15 bg-white/5 text-xs text-slate-300">
            LOBBY
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="xl:col-span-7 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-bold tracking-wide text-cyan-100">
                  SESSION MODES
                </h2>
                <span className="text-xs text-slate-300 uppercase tracking-wider">
                  Select your run
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MODES.map((mode) => {
                  const Icon = mode.icon;
                  const active = selectedMode.id === mode.id;
                  return (
                    <motion.button
                      key={mode.id}
                      whileHover={{
                        y: -3,
                        scale: 1.01,
                      }}
                      whileTap={{
                        scale: 0.99,
                      }}
                      onClick={() => setSelectedMode(mode)}
                      className={`group relative rounded-2xl overflow-hidden border text-left transition-all ${active ? "border-cyan-300/50 shadow-[0_10px_30px_rgba(34,211,238,0.22)]" : "border-white/10 hover:border-white/25"}`}
                    >
                      <div
                        className="h-28 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${mode.img})`,
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                      <div className="relative p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-black tracking-wide">
                            {mode.name}
                          </p>
                          <Icon size={16} className="text-cyan-200" />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300">
                          {mode.role}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={selectedMode.id}
                initial={{
                  opacity: 0,
                  y: 14,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                }}
                transition={{
                  duration: 0.28,
                }}
                className="rounded-2xl border border-white/10 bg-slate-900/55 backdrop-blur-xl overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr]">
                  <div
                    className="min-h-[220px] bg-cover bg-center relative"
                    style={{
                      backgroundImage: `url(${selectedMode.img})`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-transparent" />
                    <div className="relative p-5 sm:p-6 max-w-md">
                      <h3 className="text-3xl font-black leading-tight">
                        {selectedMode.name}
                      </h3>
                      <p className="mt-3 text-slate-200 text-sm sm:text-base">
                        {selectedMode.description}
                      </p>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6">
                    <p className="text-xs uppercase tracking-widest text-slate-300 mb-3">
                      Mode Abilities
                    </p>
                    <div className="space-y-2.5">
                      {selectedMode.features.map((feature: any, index: any) => (
                        <div
                          key={`${feature}-${String(index)}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-cyan-400/20 border border-cyan-300/30 flex items-center justify-center">
                            {index === 0 ? (
                              <Zap className="w-4 h-4 text-cyan-200" />
                            ) : index === 1 ? (
                              <Brain className="w-4 h-4 text-cyan-200" />
                            ) : (
                              <Clock className="w-4 h-4 text-cyan-200" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{feature}</p>
                            <p className="text-[11px] text-slate-300">
                              Ready for this session
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

          <aside className="xl:col-span-5 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black tracking-wide">
                  GAMIFICATION
                </h3>
                <Trophy className="w-5 h-5 text-amber-300" />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-300">
                  Rank Progress
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-300">Current</p>
                    <p className="text-xl font-black">{rankName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-300">Next</p>
                    <p className="text-base font-bold text-cyan-200">
                      {nextRankName}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <span>{knowledgePoints.toLocaleString()} KP</span>
                  <span>
                    {kpToNextRank > 0
                      ? `${String(kpToNextRank)} KP to next rank`
                      : "Max rank reached"}
                  </span>
                </div>

                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                    initial={{
                      width: 0,
                    }}
                    animate={{
                      width: `${String(rankProgressPercent)}%`,
                    }}
                    transition={{
                      duration: 0.6,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <Flame className="w-4 h-4 text-orange-300 mx-auto mb-1" />
                  <p className="text-lg font-black">{signals.streak}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-300">
                    Streak
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <Sparkles className="w-4 h-4 text-cyan-300 mx-auto mb-1" />
                  <p className="text-lg font-black">{signals.tasks}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-300">
                    Tasks
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <Users className="w-4 h-4 text-emerald-300 mx-auto mb-1" />
                  <p className="text-lg font-black">{signals.groupSessions}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-300">
                    Group Sessions
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-5">
              <p className="text-xs uppercase tracking-widest text-slate-300 mb-3">
                Ready to study
              </p>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-400/15 border border-cyan-300/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-cyan-200" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate">{selectedMode.name}</p>
                  <p className="text-xs text-slate-300 truncate">
                    {selectedMode.role}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLockIn}
                disabled={lockedIn}
                className={`mt-4 w-full h-12 rounded-xl font-black tracking-[0.12em] text-sm transition-all ${lockedIn ? "bg-cyan-300/30 text-cyan-50 cursor-not-allowed" : "bg-cyan-300 text-slate-900 hover:brightness-110 active:scale-[0.99] shadow-[0_10px_30px_rgba(34,211,238,0.3)]"}`}
              >
                {lockedIn ? "STARTING..." : "LOCK IN"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
export default Lobby;
