'use client';
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@/navigation";
import {
  Crown,
  UserPlus,
  Copy,
  Check,
  Play,
  ArrowLeft,
  Swords,
  Users,
  Zap,
  X,
  Search,
  Hourglass,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import useSessionStore from "../store/sessionStore";
import useFriendsStore from "../store/friendsStore";
import useNotificationStore from "../store/notificationStore";
import { profileAPI, teamSessionsAPI } from "../services/api";
import VoiceButton from "../components/VoiceChat/VoiceButton";

// XP Multiplier table
const XP_MULTIPLIERS: Record<any, any> = {
  1: {
    value: 1.0,
    label: "1.0x",
    badge: "Solo Agent",
  },
  2: {
    value: 1.15,
    label: "1.15x",
    badge: "Dynamic Duo",
  },
  3: {
    value: 1.2,
    label: "1.2x",
    badge: "Trinity Force",
  },
  4: {
    value: 1.25,
    label: "1.25x",
    badge: "Full Squadron",
  },
};
const TeamLobbyCard = ({ player, isLeader, isEmpty, onInvite, slotIndex }: any) => {
  if (isEmpty) {
    return (
      <motion.button
        whileHover={{
          scale: 1.05,
        }}
        whileTap={{
          scale: 0.95,
        }}
        onClick={onInvite}
        className="w-full aspect-[3/4] bg-[#1a2633]/50 border-2 border-dashed border-[#ffffff15] rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[var(--accent-color-dynamic)]/50 hover:bg-[var(--accent-color-dynamic)]/5 transition-all cursor-pointer group"
      >
        <div className="w-14 h-14 rounded-full bg-[#ffffff05] flex items-center justify-center group-hover:bg-[var(--accent-color-dynamic)]/10 transition-colors">
          <UserPlus
            size={24}
            className="text-gray-600 group-hover:text-[var(--accent-color-dynamic)] transition-colors"
          />
        </div>
        <span className="text-sm font-bold text-gray-600 group-hover:text-[var(--accent-color-dynamic)] tracking-wider uppercase transition-colors">
          Invite
        </span>
        <span className="text-xs text-gray-700">Slot {slotIndex + 1}</span>
      </motion.button>
    );
  }
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="w-full aspect-[3/4] bg-gradient-to-b from-[#1a2633] to-[#0f1923] border-2 rounded-xl relative overflow-hidden group"
      style={{
        borderColor:
          "color-mix(in srgb, var(--accent-color-dynamic) 30%, transparent)",
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 to-transparent"
        style={{
          backgroundImage:
            "linear-gradient(to top, color-mix(in srgb, var(--accent-color-dynamic) 10%, transparent), transparent)",
        }}
      />

      {/* Player Avatar */}
      <div className="absolute inset-0 flex items-center justify-center pt-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border-2"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--accent-color-dynamic) 20%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--accent-color-dynamic) 40%, transparent)",
          }}
        >
          {player.avatar ? (
            <img
              src={player.avatar}
              alt={player.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="text-2xl font-black"
              style={{
                color: "var(--accent-color-dynamic)",
              }}
            >
              {(player.name || "?")[0].toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Leader crown */}
      {isLeader && (
        <div className="absolute top-3 left-3 z-10">
          <Crown
            size={20}
            className="text-[var(--accent-color-dynamic)] drop-shadow-lg"
          />
        </div>
      )}

      {/* Ready indicator */}
      <div className="absolute top-3 right-3 z-10">
        <div className="w-3 h-3 bg-[var(--accent-color-dynamic)] rounded-full animate-pulse shadow-[0_0_10px_var(--accent-color-dynamic)]" />
      </div>

      {/* Player info */}
      <div className="absolute bottom-0 w-full p-4 text-center bg-gradient-to-t from-black/80 to-transparent">
        <h3 className="font-bold text-base truncate">{player.name}</h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--accent-color-dynamic) 20%, transparent)",
              color: "var(--accent-color-dynamic)",
            }}
          >
            {isLeader ? "LEADER" : "MEMBER"}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
const TeamLobby = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    teamSession,
    inviteCode,
    selectedCourse,
    startTeamSession,
    resetSession,
  } = useSessionStore();
  const {
    friends,
    fetchFriends,
    fetchParticipants,
    inviteToSession,
    teamParticipants,
  } = useFriendsStore();
  const { sessionStartSignal, clearSessionStartSignal } =
    useNotificationStore();

  // The session owner is the leader
  const isLeader = !!(
    teamSession?.userId &&
    (teamSession.userId === user?._id || teamSession.userId === user?.userId)
  );
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitedSet, setInvitedSet] = useState(new Set());
  const [friendFilter, setFriendFilter] = useState("");
  const [countdown, setCountdown] = useState<any>(null);
  const [startError, setStartError] = useState("");
  useEffect(() => {
    const loadIdentity = async () => {
      try {
        const [profileRes] = await Promise.allSettled([profileAPI.get()]);
        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value.data.profile);
        }
      } catch (error: any) {
        console.error("Failed to load profile:", error);
      }
    };
    loadIdentity();
    fetchFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Poll participants
  useEffect(() => {
    if (teamSession?._id) {
      fetchParticipants(teamSession._id);
      const interval = setInterval(
        () => fetchParticipants(teamSession._id),
        5000,
      );
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSession?._id]);
  const activeParticipants = teamParticipants.filter((p) => !p.leftAt);
  // Separate host from members for correct slot rendering
  const hostParticipant = activeParticipants.find(
    (p) => p.role === "host" || p.userId === teamSession?.userId,
  );
  const memberParticipants = activeParticipants.filter(
    (p) => p.role !== "host" && p.userId !== teamSession?.userId,
  );
  const teamSize = Math.max(activeParticipants.length, 1);
  const currentMultiplier =
    XP_MULTIPLIERS[Math.min(teamSize, 4)] || XP_MULTIPLIERS[1];
  const emptySlots = 4 - teamSize;
  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const handleInvite = async (friendId: any) => {
    if (!teamSession?._id) return;
    try {
      await inviteToSession(teamSession._id, friendId);
      setInvitedSet((prev: any) => new Set([...prev, friendId]));
    } catch {
      /* error handled in store */
    }
  };

  // Auto-launch when leader fires the start signal (for non-leaders)
  useEffect(() => {
    if (sessionStartSignal && countdown === null) {
      clearSessionStartSignal();
      startTeamSession();
      triggerCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStartSignal]);
  const triggerCountdown = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev: any) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate("/session-live");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  const handleStartSession = async () => {
    if (!isLeader || !teamSession?._id) return;
    setStartError("");
    try {
      await teamSessionsAPI.start(teamSession._id);
      startTeamSession();
      triggerCountdown();
    } catch (err: any) {
      setStartError(err.response?.data?.error || "Failed to start session");
    }
  };
  const handleCancel = () => {
    resetSession();
    navigate("/session-setup");
  };

  // Starting countdown overlay
  if (countdown !== null && countdown > 0) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a2633] to-[#0f1923]" />
        <div className="absolute inset-0 z-0 opacity-20">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[200px]"
            style={{
              backgroundColor: "var(--accent-color-dynamic)",
            }}
          />
        </div>
        <motion.div
          key={countdown}
          initial={{
            scale: 3,
            opacity: 0,
          }}
          animate={{
            scale: 1,
            opacity: 1,
          }}
          exit={{
            scale: 0,
            opacity: 0,
          }}
          className="z-20 text-center"
        >
          <h1
            className="text-[200px] font-black text-white"
            style={{
              textShadow: "0 0 30px var(--accent-color-dynamic)",
            }}
          >
            {countdown}
          </h1>
          <p
            className="font-bold tracking-[0.5em] text-xl uppercase"
            style={{
              color: "var(--accent-color-dynamic)",
            }}
          >
            SESSION STARTING
          </p>
        </motion.div>
      </div>
    );
  }
  const filteredFriends = friends.filter((f) =>
    (f.name || f.displayName || "")
      .toLowerCase()
      .includes(friendFilter.toLowerCase()),
  );
  return (
    <div className="min-h-screen overflow-x-hidden relative text-white font-sans">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a2633]/55 via-[#0f1923]/38 to-[#0f1923]/55 z-0 pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute inset-0 z-0 opacity-10">
        <div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[200px]"
          style={{
            backgroundColor: "var(--accent-color-dynamic)",
          }}
        />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[var(--accent-color-dynamic)] rounded-full blur-[200px]" />
      </div>

      {/* Top bar */}
      <div className="relative z-20 h-20 px-8 flex items-center border-b border-[#ffffff10] bg-[#0f1923]/80 backdrop-blur-md">
        <button
          onClick={handleCancel}
          className="mr-4 p-2 hover:bg-[#ffffff10] rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <Swords
          size={24}
          className="mr-3"
          style={{
            color: "var(--accent-color-dynamic)",
          }}
        />
        <h1 className="text-2xl font-bold tracking-wider uppercase">
          TEAM LOBBY
        </h1>

        {/* Course name */}
        <div className="ml-6 px-3 py-1 bg-[#ffffff05] border border-[#ffffff10] rounded-lg text-sm text-gray-400">
          {selectedCourse?.title || "Course"}
        </div>

        {/* XP Multiplier Badge */}
        <div className="ml-auto flex items-center gap-4">
          <div className="w-[300px]"></div>

          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in srgb, var(--accent-color-dynamic) 10%, transparent), var(--accent-color-dynamic) 10%)",
              borderColor:
                "color-mix(in srgb, var(--accent-color-dynamic) 30%, transparent)",
              borderWidth: "1px",
            }}
          >
            <Zap
              size={16}
              style={{
                color: "var(--accent-color-dynamic)",
              }}
            />
            <span
              className="font-bold"
              style={{
                color: "var(--accent-color-dynamic)",
              }}
            >
              {currentMultiplier.label} XP
            </span>
            <span className="text-xs text-gray-500">
              {currentMultiplier.badge}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex h-[calc(100vh-80px)]">
        {/* Left panel — Player slots */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold tracking-widest text-gray-400 uppercase mb-2">
                TEAM COMPOSITION
              </h2>
              <p className="text-gray-600 text-sm">
                {teamSize}/4 players •{" "}
                {emptySlots > 0
                  ? `${emptySlots} slot${emptySlots > 1 ? "s" : ""} available`
                  : "Team full!"}
              </p>
            </div>

            {/* 4 Player slots — League of Legends style */}
            <div className="grid grid-cols-4 gap-4">
              {/* Slot 1: Always the session leader */}
              <TeamLobbyCard
                player={
                  hostParticipant || {
                    name: isLeader
                      ? profile?.nickname || user?.name || "You"
                      : "Leader",
                    avatar: isLeader ? profile?.avatar : null,
                  }
                }
                isLeader={true}
                slotIndex={0}
              />

              {/* Slots 2-4: Members or empty */}
              {[0, 1, 2].map((idx) => {
                const participant = memberParticipants[idx];
                if (participant) {
                  return (
                    <TeamLobbyCard
                      key={participant.userId}
                      player={participant}
                      isLeader={false}
                      slotIndex={idx + 1}
                    />
                  );
                }
                return (
                  <TeamLobbyCard
                    key={`empty-${idx}`}
                    isEmpty={true}
                    onInvite={() => setShowInviteModal(true)}
                    slotIndex={idx + 1}
                  />
                );
              })}
            </div>

            {/* Invite Code Section */}
            {inviteCode && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="mt-8 flex items-center justify-center gap-4"
              >
                <div className="bg-[#1a2633] border border-[#ffffff10] rounded-xl px-6 py-3 flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-bold tracking-wider uppercase">
                      INVITE CODE
                    </p>
                    <p
                      className="text-2xl font-mono font-bold tracking-[0.3em]"
                      style={{
                        color: "var(--accent-color-dynamic)",
                      }}
                    >
                      {inviteCode}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors"
                    title="Copy invite code"
                  >
                    {copied ? (
                      <Check
                        size={20}
                        className="text-[var(--accent-color-dynamic)]"
                      />
                    ) : (
                      <Copy size={20} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right sidebar — Friends list */}
        <div className="w-80 border-l border-[#ffffff10] bg-[#0f1923]/50 backdrop-blur-sm flex flex-col">
          {teamSession?._id && user?._id && (
            <div className="p-4 border-b border-[#ffffff10]">
              <VoiceButton sessionId={teamSession._id} userId={user._id} />
            </div>
          )}

          <div className="p-4 border-b border-[#ffffff10]">
            <h3 className="font-bold tracking-wider text-sm uppercase text-gray-400 mb-3 flex items-center gap-2">
              <Users size={16} />
              FRIENDS
            </h3>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
              />
              <input
                type="text"
                value={friendFilter}
                onChange={(e: any) => setFriendFilter(e.target.value)}
                placeholder="Search friends..."
                className="w-full bg-[#1a2633] border border-[#ffffff10] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                onFocus={(e: any) => {
                  e.currentTarget.style.borderColor =
                    "color-mix(in srgb, var(--accent-color-dynamic) 50%, transparent)";
                }}
                onBlur={(e: any) => {
                  e.currentTarget.style.borderColor = "#ffffff10";
                }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {filteredFriends.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">
                {friends.length === 0
                  ? "No friends yet — add some!"
                  : "No matches"}
              </p>
            ) : (
              filteredFriends.map((friend) => {
                const friendId = friend.userId || friend._id;
                const isInvited = invitedSet.has(friendId);
                return (
                  <div
                    key={friendId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#ffffff05] transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--accent-color-dynamic) 20%, transparent)",
                        color: "var(--accent-color-dynamic)",
                      }}
                    >
                      {(friend.name ||
                        friend.displayName ||
                        "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {friend.name || friend.displayName}
                      </p>
                    </div>
                    {isInvited ? (
                      <span className="text-xs text-[var(--accent-color-dynamic)] flex items-center gap-1">
                        <Check size={12} /> Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvite(friendId)}
                        className="px-3 py-1 text-xs rounded-lg hover:bg-[#ffffff05] transition-colors font-bold"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--accent-color-dynamic) 20%, transparent)",
                          color: "var(--accent-color-dynamic)",
                        }}
                      >
                        Invite
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0f1923] border-t border-[#ffffff10] flex flex-col items-center justify-center px-8 gap-1 py-3">
        {startError && (
          <p className="text-xs text-[var(--accent-color-dynamic)] font-bold tracking-wider">
            {startError}
          </p>
        )}

        <div className="flex items-center gap-6">
          <button
            onClick={handleCancel}
            className="px-8 py-3 bg-[#1a2633] border border-[#ffffff10] text-gray-400 font-bold tracking-wider uppercase hover:bg-[#ffffff10] transition-all rounded"
          >
            CANCEL
          </button>

          {isLeader && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-8 py-3 bg-[var(--accent-color-dynamic)]/10 border border-[var(--accent-color-dynamic)]/30 text-[var(--accent-color-dynamic)] font-bold tracking-wider uppercase hover:bg-[var(--accent-color-dynamic)]/20 transition-all rounded flex items-center gap-2"
            >
              <UserPlus size={18} />
              INVITE
            </button>
          )}

          {isLeader ? (
            <button
              onClick={handleStartSession}
              className="px-16 py-4 bg-[var(--accent-color-dynamic)] text-white font-black text-xl tracking-widest uppercase hover:bg-[var(--accent-color-dynamic-hover)] transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_var(--accent-color-dynamic-shadow-40)]"
              style={{
                clipPath:
                  "polygon(5% 0, 100% 0, 100% 70%, 95% 100%, 0 100%, 0 30%)",
              }}
            >
              <span className="flex items-center gap-3">
                <Play size={20} />
                START SESSION
              </span>
            </button>
          ) : (
            <div className="px-10 py-4 bg-[#1a2633] border border-[#ffffff15] text-gray-500 font-bold tracking-widest uppercase flex items-center gap-3 rounded">
              <Hourglass size={18} className="animate-pulse" />
              WAITING FOR LEADER
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{
                scale: 0.95,
                y: 20,
              }}
              animate={{
                scale: 1,
                y: 0,
              }}
              exit={{
                scale: 0.95,
                y: 20,
              }}
              onClick={(e: any) => e.stopPropagation()}
              className="bg-[#1a2633] border border-[#ffffff10] rounded-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-[#ffffff10]">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <UserPlus
                    size={20}
                    className="text-[var(--accent-color-dynamic)]"
                  />
                  Invite Friends
                </h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-1 hover:bg-[#ffffff10] rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Invite code display */}
              {inviteCode && (
                <div className="mx-5 mt-4 p-4 bg-[#0f1923] border border-[#ffffff10] rounded-xl">
                  <p className="text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">
                    Share invite code
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-mono font-bold text-[var(--accent-color-dynamic)] tracking-[0.3em]">
                      {inviteCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-2 hover:bg-[#ffffff10] rounded-lg transition-colors"
                    >
                      {copied ? (
                        <Check
                          size={16}
                          className="text-[var(--accent-color-dynamic)]"
                        />
                      ) : (
                        <Copy size={16} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                  {teamSession?._id && (
                    <p className="text-xs text-gray-600 mt-2">
                      Session ID: {teamSession._id}
                    </p>
                  )}
                </div>
              )}

              {/* Friends list */}
              <div className="p-5">
                <div className="relative mb-4">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
                  />
                  <input
                    type="text"
                    value={friendFilter}
                    onChange={(e: any) => setFriendFilter(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full bg-[#0f1923] border border-[#ffffff10] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[var(--accent-color-dynamic)]/50 focus:outline-none"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
                  {filteredFriends.map((friend) => {
                    const friendId = friend.userId || friend._id;
                    const isInvited = invitedSet.has(friendId);
                    return (
                      <div
                        key={friendId}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-[#ffffff05]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[var(--accent-color-dynamic)]/20 rounded-full flex items-center justify-center text-[var(--accent-color-dynamic)] font-bold">
                            {(friend.name ||
                              friend.displayName ||
                              "?")[0].toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {friend.name || friend.displayName}
                          </span>
                        </div>
                        {isInvited ? (
                          <span className="text-xs text-[var(--accent-color-dynamic)] flex items-center gap-1">
                            <Check size={14} /> Invited
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInvite(friendId)}
                            className="px-4 py-1.5 text-sm bg-[var(--accent-color-dynamic)] text-black rounded-lg hover:bg-[var(--accent-color-dynamic)]/80 transition-colors font-bold"
                          >
                            Invite
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default TeamLobby;
