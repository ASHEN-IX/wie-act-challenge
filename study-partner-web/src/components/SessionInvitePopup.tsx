import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@/navigation";
import { Swords, X, LogIn } from "lucide-react";
import useNotificationStore from "../store/notificationStore";
import useSessionStore from "../store/sessionStore";

const INVITE_TIMEOUT = 30; // seconds

const SessionInvitePopup = () => {
  const navigate = useNavigate();
  const pendingInvites = useNotificationStore((s) => s.pendingInvites);
  const dismissInvite = useNotificationStore((s) => s.dismissInvite);
  const joinTeamSessionFromInvite = useSessionStore(
    (s) => s.joinTeamSessionFromInvite,
  );

  const invite = pendingInvites[0] || null;
  const [countdown, setCountdown] = useState(INVITE_TIMEOUT);
  const [joining, setJoining] = useState(false);

  // Reset countdown when a new invite arrives
  useEffect(() => {
    if (!invite) return;
    setCountdown(INVITE_TIMEOUT);
    const interval = setInterval(() => {
      setCountdown((prev: any) => {
        if (prev <= 1) {
          clearInterval(interval);
          dismissInvite(invite._id || invite.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [invite?._id, invite?.id, dismissInvite]);

  const handleJoin = async () => {
    if (!invite) return;
    setJoining(true);
    try {
      const meta = invite.metadata || {};
      await joinTeamSessionFromInvite(meta.sessionId, meta.inviteCode);
      dismissInvite(invite._id || invite.id);
      navigate("/team-lobby");
    } catch {
      // stay on popup so user can retry
    } finally {
      setJoining(false);
    }
  };

  const handleDismiss = () => {
    if (!invite) return;
    dismissInvite(invite._id || invite.id);
  };

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          key={invite._id || invite.id}
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          className="fixed bottom-6 right-6 z-[9999] w-80"
        >
          <div className="relative bg-card/95 backdrop-blur-lg border border-[var(--accent-color-dynamic)]/40 rounded-2xl p-5 shadow-2xl shadow-cyan-500/10">
            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[var(--accent-color-dynamic)]/10 rounded-xl">
                <Swords className="w-5 h-5 text-[var(--accent-color-dynamic)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Game Room Invite!</p>
                <p className="text-xs text-muted-foreground truncate">
                  {invite.message || "You've been invited to a team session"}
                </p>
              </div>
            </div>

            {/* Course and inviter info */}
            {invite.metadata?.courseName && (
              <p className="text-xs text-muted-foreground mb-3 truncate">
                📚 {invite.metadata.courseName}
                {invite.metadata.inviterName &&
                  ` • by ${invite.metadata.inviterName}`}
              </p>
            )}

            {/* Countdown bar */}
            <div className="w-full h-1 bg-muted rounded-full mb-4 overflow-hidden">
              <motion.div
                className="h-full bg-[var(--accent-color-dynamic)] rounded-full"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{
                  duration: INVITE_TIMEOUT,
                  ease: "linear",
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                Dismiss ({countdown}s)
              </button>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-[var(--accent-color-dynamic)] text-white hover:bg-[var(--accent-color-dynamic)] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                {joining ? "Joining..." : "JOIN"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionInvitePopup;
