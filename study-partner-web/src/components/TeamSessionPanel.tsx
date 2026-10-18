import React, { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Crown,
  Copy,
  UserPlus,
  LogOut,
  StopCircle,
  Clock,
} from "lucide-react";
import useFriendsStore from "../store/friendsStore";
function TeamSessionPanel({
  sessionId,
  isHost,
  inviteCode,
  onInvite,
  onEnd,
  showActions = true,
}: any) {
  const { teamParticipants, fetchParticipants, leaveTeamSession } =
    useFriendsStore();
  useEffect(() => {
    if (sessionId) {
      fetchParticipants(sessionId);
      const interval = setInterval(() => fetchParticipants(sessionId), 15000);
      return () => clearInterval(interval);
    }
  }, [sessionId]);
  const copyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
    }
  };
  const handleLeave = async () => {
    if (sessionId) await leaveTeamSession(sessionId);
  };
  const activeParticipants = teamParticipants.filter((p) => !p.leftAt);
  return (
    <motion.div
      initial={{
        opacity: 0,
        x: 20,
      }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 w-72"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Users size={16} className="text-[var(--accent-color-dynamic)]" />
          Team Session
        </h3>
        <span className="text-xs text-gray-500">
          {activeParticipants.length} active
        </span>
      </div>

      {/* Invite Code */}
      {inviteCode && (
        <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">Invite Code</p>
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-[var(--accent-color-dynamic)] text-lg tracking-wider">
              {inviteCode}
            </span>
            <button
              onClick={copyInviteCode}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title="Copy code"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
        {teamParticipants.map((p: any, i: any) => (
          <div
            key={p.userId || i}
            className={`flex items-center gap-2 p-2 rounded-lg ${p.leftAt ? "opacity-50" : "bg-gray-700/30"}`}
          >
            <div className="w-8 h-8 bg-[var(--accent-color-dynamic)]/30 rounded-full flex items-center justify-center text-[var(--accent-color-dynamic)] text-sm font-bold">
              {(p.name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1">
                {p.name}
                {p.role === "host" && (
                  <Crown
                    size={12}
                    className="text-[var(--accent-color-dynamic)]"
                  />
                )}
              </p>

              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={10} />
                {p.durationMinutes || 0}m{p.leftAt && " (left)"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showActions && (
        <div className="space-y-2">
          <button
            onClick={onInvite}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] rounded-lg hover:bg-[var(--accent-color-dynamic)]/30 transition-colors text-sm"
          >
            <UserPlus size={14} /> Invite Friend
          </button>

          {isHost ? (
            <button
              onClick={onEnd}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] rounded-lg hover:bg-[var(--accent-color-dynamic)]/30 transition-colors text-sm"
            >
              <StopCircle size={14} /> End Session
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              <LogOut size={14} /> Leave Session
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
export default TeamSessionPanel;
