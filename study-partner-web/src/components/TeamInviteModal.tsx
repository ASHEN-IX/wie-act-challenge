import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Search, UserPlus, Check } from "lucide-react";
import useFriendsStore from "../store/friendsStore";

function TeamInviteModal({ sessionId, onClose }: any) {
  const { friends, fetchFriends, inviteToSession } = useFriendsStore();
  const [filter, setFilter] = useState("");
  const [invited, setInvited] = useState(new Set());

  useEffect(() => {
    fetchFriends();
  }, []);

  const filteredFriends = friends.filter((f) =>
    (f.name || f.displayName || "")
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );

  const handleInvite = async (friendId: any) => {
    try {
      await inviteToSession(sessionId, friendId);
      setInvited((prev: any) => new Set([...prev, friendId]));
    } catch {
      // error handled in store
    }
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
        className="bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <h3 className="font-semibold flex items-center gap-2">
            <UserPlus
              size={18}
              className="text-[var(--accent-color-dynamic)]"
            />
            Invite Friends
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              value={filter}
              onChange={(e: any) => setFilter(e.target.value)}
              placeholder="Filter friends..."
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[var(--accent-color-dynamic)] focus:outline-none"
            />
          </div>
        </div>

        {/* Friends List */}
        <div className="max-h-64 overflow-y-auto px-4 pb-4 space-y-2">
          {filteredFriends.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              {friends.length === 0 ? "No friends yet" : "No matches"}
            </p>
          ) : (
            filteredFriends.map((friend) => {
              const friendId = friend.friendId || friend._id;
              const isInvited = invited.has(friendId);
              return (
                <div
                  key={friendId}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[var(--accent-color-dynamic)]/30 rounded-full flex items-center justify-center text-[var(--accent-color-dynamic)] text-sm font-bold">
                      {(friend.name ||
                        friend.displayName ||
                        "?")[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">
                      {friend.name || friend.displayName}
                    </span>
                  </div>
                  {isInvited ? (
                    <span className="text-[var(--accent-color-dynamic)] text-xs flex items-center gap-1">
                      <Check size={12} /> Invited
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInvite(friendId)}
                      className="px-3 py-1 text-xs bg-[var(--accent-color-dynamic)] text-white rounded-lg hover:bg-[var(--accent-color-dynamic)] transition-colors"
                    >
                      Invite
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default TeamInviteModal;
