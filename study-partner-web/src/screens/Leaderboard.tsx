'use client';
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { gamificationAPI, friendsAPI, profileAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import {
  Trophy,
  Crown,
  Star,
  Zap,
  Medal,
  TrendingUp,
  Award,
  Loader2,
  Users,
} from "lucide-react";

const RANK_COLORS = [
  "text-[var(--accent-color-dynamic)]",
  "text-gray-300",
  "text-[var(--accent-color-dynamic)]",
];
const RANK_ICONS = [Crown, Medal, Award];
const RANK_LADDER = [
  { name: "Novice III", minKp: 0 },
  { name: "Novice II", minKp: 150 },
  { name: "Novice I", minKp: 300 },
  { name: "Explorer III", minKp: 450 },
  { name: "Explorer II", minKp: 600 },
  { name: "Explorer I", minKp: 750 },
  { name: "Scholar III", minKp: 900 },
  { name: "Scholar II", minKp: 1050 },
  { name: "Scholar I", minKp: 1200 },
  { name: "Strategist III", minKp: 1350 },
  { name: "Strategist II", minKp: 1500 },
  { name: "Strategist I", minKp: 1650 },
  { name: "Expert III", minKp: 1800 },
  { name: "Expert II", minKp: 2000 },
  { name: "Expert I", minKp: 2200 },
  { name: "Master III", minKp: 2400 },
  { name: "Master II", minKp: 2600 },
  { name: "Master I", minKp: 2800 },
  { name: "Grandmaster II", minKp: 3000 },
  { name: "Grandmaster I", minKp: 3250 },
  { name: "Legend", minKp: 3500 },
];

const getRankBarProgress = (profile: any) => {
  const knowledgePoints = Number(profile?.knowledgePoints || 0);
  const rankIndex = Number.isFinite(profile?.rankIndex)
    ? profile.rankIndex
    : RANK_LADDER.findIndex((rank: any, idx: any) => {
        const next = RANK_LADDER[idx + 1];
        return !next || knowledgePoints < next.minKp;
      });

  const current = RANK_LADDER[Math.max(0, rankIndex)] || RANK_LADDER[0];
  const next = RANK_LADDER[Math.min(RANK_LADDER.length - 1, rankIndex + 1)];
  if (!next || next.name === current.name) {
    return {
      leftLabel: current.name,
      rightLabel: "MAX",
      progressPercent: 100,
      detail: `${knowledgePoints} KP`,
    };
  }

  const span = Math.max(1, next.minKp - current.minKp);
  const progressPercent = Math.max(
    0,
    Math.min(100, ((knowledgePoints - current.minKp) / span) * 100),
  );

  return {
    leftLabel: current.name,
    rightLabel: next.name,
    progressPercent,
    detail: `${knowledgePoints}/${next.minKp} KP`,
  };
};

const Leaderboard = () => {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [rankLeaderboard, setRankLeaderboard] = useState<any[]>([]);
  const [rankProfile, setRankProfile] = useState<any>(null);
  const [currentSeason, setCurrentSeason] = useState<any>(null);
  const [rankProgressInfo, setRankProgressInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [viewMode, setViewMode] = useState("xp");
  const [friendIds, setFriendIds] = useState(new Set());
  const [userStatuses, setUserStatuses] = useState({});

  const fetchOnlineStatuses = async (entries: any) => {
    const userIds = (entries || [])
      .map((entry: any) => entry.userId)
      .filter(Boolean);
    if (!userIds.length) return;

    try {
      const response = await profileAPI.getOnlineStatusBatch(userIds);
      const statusMap = (response.data?.statuses || []).reduce(
        (acc: any, status: any) => {
          acc[status.userId] = status;
          return acc;
        },
        {},
      );
      setUserStatuses(statusMap);
    } catch {
      // non-critical for leaderboard rendering
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          lbResult,
          profileResult,
          rankLbResult,
          rankProfileResult,
          seasonResult,
          rankProgressResult,
        ] = await Promise.allSettled([
          gamificationAPI.getLeaderboard(20),
          gamificationAPI.getProfile(),
          gamificationAPI.getRankLeaderboard({ limit: 20, scope: "all" }),
          gamificationAPI.getRankProfile(),
          gamificationAPI.getCurrentSeason(),
          gamificationAPI.getRankProgress(),
        ]);

        const xpLeaderboard =
          lbResult.status === "fulfilled" && Array.isArray(lbResult.value)
            ? lbResult.value
            : [];
        const xpProfile =
          profileResult.status === "fulfilled" ? profileResult.value : null;
        const rankedRows =
          rankLbResult.status === "fulfilled"
            ? rankLbResult.value?.leaderboard || []
            : [];
        const rankedProfile =
          rankProfileResult.status === "fulfilled"
            ? rankProfileResult.value?.profile || null
            : null;
        const season =
          seasonResult.status === "fulfilled"
            ? seasonResult.value?.season || null
            : null;
        const progress =
          rankProgressResult.status === "fulfilled"
            ? rankProgressResult.value?.progress || null
            : null;

        setLeaderboard(xpLeaderboard);
        setMyProfile(xpProfile);
        setRankLeaderboard(rankedRows);
        setRankProfile(rankedProfile);
        setCurrentSeason(season);
        setRankProgressInfo(progress);

        fetchOnlineStatuses(xpLeaderboard);

        // Fetch friend IDs for filtering
        try {
          const friendsData = await friendsAPI.getAll();
          const ids = new Set(
            (friendsData.friends || friendsData || []).map(
              (f: any) => f.userId || f.friendId || f._id,
            ),
          );
          if (user?._id) ids.add(user._id);
          setFriendIds(ids);
        } catch {
          // Friends API may not be available
        }
      } catch (err: any) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?._id]);

  useEffect(() => {
    const sourceEntries = viewMode === "rank" ? rankLeaderboard : leaderboard;
    if (!sourceEntries.length) return;

    fetchOnlineStatuses(sourceEntries);

    const timer = setInterval(() => {
      fetchOnlineStatuses(sourceEntries);
    }, 30000);

    return () => clearInterval(timer);
  }, [viewMode, leaderboard, rankLeaderboard]);

  const sourceLeaderboard = viewMode === "rank" ? rankLeaderboard : leaderboard;

  const displayedLeaderboard = friendsOnly
    ? sourceLeaderboard.filter((e: any) => friendIds.has(e.userId))
    : sourceLeaderboard;

  const myRank =
    displayedLeaderboard.findIndex((e: any) => e.userId === user?._id) + 1;

  const rankProgress = getRankBarProgress(rankProfile);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-3 mb-3">
          <Trophy className="w-8 h-8 text-[var(--accent-color-dynamic)]" />
          <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
        </div>
        <p className="text-muted-foreground">
          {viewMode === "rank"
            ? "Compete in the seasonal ranked ladder"
            : "See how you stack up by XP"}
        </p>
        {viewMode === "rank" && currentSeason && (
          <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">
            {currentSeason.name || currentSeason.seasonCode} • Soft reset each
            season
          </p>
        )}
        <div className="flex justify-center mt-4 gap-2 flex-wrap">
          <button
            onClick={() => setViewMode("xp")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              viewMode === "xp"
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            XP Mode
          </button>
          <button
            onClick={() => setViewMode("rank")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              viewMode === "rank"
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            Ranked Mode
          </button>

          <button
            onClick={() => setFriendsOnly(!friendsOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              friendsOnly
                ? "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] border-[var(--accent-color-dynamic)]/30"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            <Users className="w-4 h-4" />
            {friendsOnly ? "Friends Only" : "All Users"}
          </button>
        </div>
      </motion.div>

      {/* My Stats Card */}
      {(viewMode === "xp" ? myProfile : rankProfile) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-6 rounded-2xl border border-primary/30 bg-primary/5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                <Star className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Rank</p>
                <p className="text-2xl font-bold text-foreground">
                  #{myRank || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {viewMode === "rank" ? "Rank" : "Level"}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {viewMode === "rank"
                    ? rankProfile?.rankName || "Unranked"
                    : myProfile.level}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {viewMode === "rank" ? "Knowledge Points" : "Total XP"}
                </p>
                <p className="text-xl font-bold text-primary">
                  {viewMode === "rank"
                    ? Number(rankProfile?.knowledgePoints || 0).toLocaleString()
                    : myProfile.total_xp?.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {viewMode === "rank" ? "Season Events" : "Tasks Done"}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {viewMode === "rank"
                    ? rankProfile?.competitiveEventsCountSeason || 0
                    : myProfile.stats?.tasksCompleted || 0}
                </p>
              </div>
            </div>
            {/* XP Progress to next level */}
            <div className="w-full mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {viewMode === "rank"
                    ? rankProgress.leftLabel
                    : `Level ${myProfile.level}`}
                </span>
                <span>
                  {viewMode === "rank"
                    ? rankProgress.detail
                    : `${myProfile.total_xp % 100}/100 XP`}
                </span>
                <span>
                  {viewMode === "rank"
                    ? rankProgress.rightLabel
                    : `Level ${myProfile.level + 1}`}
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      viewMode === "rank"
                        ? rankProgress.progressPercent
                        : myProfile.total_xp % 100
                    }%`,
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              {viewMode === "rank" && rankProgressInfo && (
                <p className="mt-2 text-xs text-muted-foreground text-right">
                  {rankProgressInfo.kpToNextRank > 0
                    ? `${rankProgressInfo.kpToNextRank} KP to next rank`
                    : "Max rank reached"}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Achievements Section */}
      {viewMode === "xp" &&
        myProfile?.achievements &&
        myProfile.achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" /> Your Achievements
            </h2>
            <div className="flex flex-wrap gap-3">
              {myProfile.achievements.map((ach: any) => (
                <div
                  key={ach.id}
                  className="px-4 py-2 rounded-xl bg-card border border-border flex items-center gap-2 text-sm"
                  title={ach.description}
                >
                  <span className="text-lg">{ach.icon}</span>
                  <span className="font-medium text-foreground">
                    {ach.name}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      {/* Leaderboard Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-border bg-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {viewMode === "rank" ? "Division" : "Level"}
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {viewMode === "rank" ? "KP" : "XP"}
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {viewMode === "rank" ? "Peak" : "Tasks"}
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {viewMode === "rank" ? "Activity" : "Courses"}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedLeaderboard.map((entry: any, idx: any) => {
                const isMe = entry.userId === user?._id;
                const RankIcon = RANK_ICONS[idx] || TrendingUp;
                const rankColor = RANK_COLORS[idx] || "text-muted-foreground";

                return (
                  <motion.tr
                    key={entry.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * idx }}
                    className={`border-b border-border/50 transition-colors ${
                      isMe ? "bg-primary/10" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <RankIcon className={`w-5 h-5 ${rankColor}`} />
                        <span className={`font-bold ${rankColor}`}>
                          #{idx + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                          {(entry.nickname || `P${idx + 1}`)
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span
                          className={`font-medium ${isMe ? "text-primary" : "text-foreground"}`}
                        >
                          {isMe
                            ? "You"
                            : entry.nickname || `Player #${idx + 1}`}
                        </span>
                        {!isMe && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                (userStatuses as any)[entry.userId]?.isOnline
                                  ? "bg-[var(--accent-color-dynamic)]"
                                  : "bg-gray-400"
                              }`}
                            />
                            {(userStatuses as any)[entry.userId]?.isOnline
                              ? "Online"
                              : "Offline"}
                          </span>
                        )}
                        {isMe && <Zap className="w-4 h-4 text-primary" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                        <Star className="w-3 h-3" />{" "}
                        {viewMode === "rank"
                          ? entry.rankName || "Unranked"
                          : entry.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-foreground">
                      {viewMode === "rank"
                        ? Number(entry.knowledgePoints || 0).toLocaleString()
                        : entry.totalXp?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground">
                      {viewMode === "rank"
                        ? entry.seasonPeakKp || 0
                        : entry.stats?.tasksCompleted || 0}
                    </td>
                    <td className="px-6 py-4 text-center text-muted-foreground">
                      {viewMode === "rank"
                        ? (entry.seasonPeakRankIndex ?? "-")
                        : entry.stats?.coursesUploaded || 0}
                    </td>
                  </motion.tr>
                );
              })}
              {sourceLeaderboard.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    {viewMode === "rank"
                      ? "No ranked players yet. Start earning KP!"
                      : "No players yet. Be the first to earn XP!"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Leaderboard;
