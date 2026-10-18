import React from "react";
import { motion } from "framer-motion";
import {
  X,
  Users,
  Clock,
  Trophy,
  BookOpen,
  Shield,
  UserMinus,
  Flame,
} from "lucide-react";
import useFriendsStore from "../store/friendsStore";

function FriendProfileModal({ onClose }: any) {
  const { selectedFriend, removeFriend, blockUser } = useFriendsStore();

  if (!selectedFriend) return null;

  const profile = selectedFriend;

  const handleRemove = async () => {
    await removeFriend(profile.userId || profile._id);
    onClose();
  };

  const handleBlock = async () => {
    await blockUser(profile.userId || profile._id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e: any) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[var(--accent-color-dynamic)]/20 to-[var(--accent-color-dynamic)]/20 p-6 pb-12">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Avatar */}
        <div className="relative flex justify-center -mt-8">
          <div className="w-16 h-16 bg-[var(--accent-color-dynamic)] rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-gray-900">
            {(profile.displayName || profile.name || "?")[0].toUpperCase()}
          </div>
        </div>

        {/* Info */}
        <div className="text-center px-6 mt-3">
          <h2 className="text-xl font-bold">
            {profile.displayName || profile.name}
          </h2>
          {profile.bio && (
            <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>
          )}
          {profile.level && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Trophy
                size={14}
                className="text-[var(--accent-color-dynamic)]"
              />
              <span className="text-sm text-gray-400">
                Level {profile.level.current || profile.level}
              </span>
              {profile.streak > 0 && (
                <>
                  <Flame
                    size={14}
                    className="text-[var(--accent-color-dynamic)] ml-2"
                  />
                  <span className="text-sm text-gray-400">
                    {profile.streak} day streak
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 px-6 mt-6">
          <StatCard
            icon={
              <Clock size={16} className="text-[var(--accent-color-dynamic)]" />
            }
            label="Study Hours"
            value={
              profile.totalStudyHours || profile.stats?.totalStudyHours || 0
            }
          />
          <StatCard
            icon={
              <BookOpen
                size={16}
                className="text-[var(--accent-color-dynamic)]"
              />
            }
            label="Sessions"
            value={profile.totalSessions || profile.stats?.totalSessions || 0}
          />
          <StatCard
            icon={
              <Users size={16} className="text-[var(--accent-color-dynamic)]" />
            }
            label="Friends"
            value={profile.friendCount || 0}
          />
        </div>

        {/* Badges */}
        {profile.badges && profile.badges.length > 0 && (
          <div className="px-6 mt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Badges
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.badges.slice(0, 6).map((badge: any, i: any) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] text-xs rounded-full"
                >
                  {badge.name || badge}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-6 mt-2">
          <button
            onClick={handleRemove}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-[var(--accent-color-dynamic)] rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            <UserMinus size={14} /> Remove
          </button>
          <button
            onClick={handleBlock}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-[var(--accent-color-dynamic)] rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            <Shield size={14} /> Block
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon, label, value }: any) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default FriendProfileModal;
