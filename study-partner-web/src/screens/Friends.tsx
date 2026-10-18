'use client';
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Search,
  Ban,
  Check,
  X,
  Copy,
  Clock,
  MoreVertical,
  UserMinus,
  Shield,
} from "lucide-react";
import useFriendsStore from "../store/friendsStore";
import { useAuthStore } from "../store/authStore";
import FriendProfileModal from "../components/FriendProfileModal";

const tabs = [
  { id: "friends", label: "My Friends", icon: Users },
  { id: "requests", label: "Requests", icon: UserPlus },
  { id: "find", label: "Find Friends", icon: Search },
  { id: "blocked", label: "Blocked", icon: Ban },
];

const statusColors: Record<string, string> = {
  online: "bg-[var(--accent-color-dynamic)]",
  studying: "bg-[var(--accent-color-dynamic)]",
  offline: "bg-gray-400",
};

function Friends() {
  const [activeTab, setActiveTab] = useState("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<any>(null);

  const {
    friends,
    incomingRequests,
    outgoingRequests,
    blockedUsers,
    searchResults,
    friendCount,
    onlineFriends,
    loading,
    error,
    fetchFriends,
    fetchIncomingRequests,
    fetchOutgoingRequests,
    fetchBlocked,
    fetchOnlineFriends,
    fetchFriendCount,
    searchUsers,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend,
    blockUser,
    unblockUser,
    getFriendProfile,
    clearError,
  } = useFriendsStore();

  // Ensure arrays are actually arrays
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeIncoming = Array.isArray(incomingRequests) ? incomingRequests : [];
  const safeOutgoing = Array.isArray(outgoingRequests) ? outgoingRequests : [];
  const safeBlocked = Array.isArray(blockedUsers) ? blockedUsers : [];
  const safeSearchResults = Array.isArray(searchResults) ? searchResults : [];

  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchFriends();
    fetchIncomingRequests();
    fetchOutgoingRequests();
    fetchFriendCount();
    fetchOnlineFriends();
  }, []);

  useEffect(() => {
    if (activeTab === "blocked") fetchBlocked();
  }, [activeTab]);

  useEffect(() => {
    if (error) {
      showNotification(error, "error");
      clearError();
    }
  }, [error]);

  const showNotification = (message: any, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSearch = useCallback(
    (e: any) => {
      const q = e.target.value;
      setSearchQuery(q);
      searchUsers(q);
    },
    [searchUsers],
  );

  const handleSendRequestByCode = async () => {
    if (!friendCodeInput.trim()) return;
    try {
      await sendRequest({ friendCode: friendCodeInput.trim() });
      setFriendCodeInput("");
      showNotification("Friend request sent!");
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  const handleSendRequestById = async (userId: any) => {
    try {
      await sendRequest({ userId });
      showNotification("Friend request sent!");
    } catch (err: any) {
      showNotification(err.message, "error");
    }
  };

  const handleAccept = async (id: any) => {
    await acceptRequest(id);
    showNotification("Friend request accepted!");
  };

  const handleReject = async (id: any) => {
    await rejectRequest(id);
    showNotification("Request rejected");
  };

  const handleCancel = async (id: any) => {
    await cancelRequest(id);
    showNotification("Request cancelled");
  };

  const handleRemoveFriend = async (friendId: any) => {
    await removeFriend(friendId);
    setContextMenu(null);
    showNotification("Friend removed");
  };

  const handleBlock = async (userId: any) => {
    await blockUser(userId);
    setContextMenu(null);
    showNotification("User blocked");
  };

  const handleUnblock = async (userId: any) => {
    await unblockUser(userId);
    showNotification("User unblocked");
  };

  const handleViewProfile = async (friendId: any) => {
    await getFriendProfile(friendId);
    setShowProfileModal(true);
    setContextMenu(null);
  };

  const copyFriendCode = () => {
    if (user?.friendCode) {
      navigator.clipboard.writeText(user.friendCode);
      showNotification("Friend code copied!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
              notification.type === "error"
                ? "bg-[var(--accent-color-dynamic)]/90"
                : "bg-[var(--accent-color-dynamic)]/90"
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Friends</h1>
            <p className="text-gray-400 mt-1">
              {friendCount} friend{friendCount !== 1 ? "s" : ""} &middot;{" "}
              {onlineFriends.length} online
            </p>
          </div>

          {/* Friend Code */}
          <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2">
            <span className="text-gray-400 text-sm">My Code:</span>
            <span className="font-mono font-bold text-[var(--accent-color-dynamic)]">
              {user?.friendCode || "--------"}
            </span>
            <button
              onClick={copyFriendCode}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Copy friend code"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? "bg-[var(--accent-color-dynamic)] text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.id === "requests" && incomingRequests.length > 0 && (
                <span className="bg-[var(--accent-color-dynamic)] text-white text-xs px-1.5 py-0.5 rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "friends" && (
              <FriendsTab
                friends={safeFriends}
                loading={loading}
                onViewProfile={handleViewProfile}
                onRemove={handleRemoveFriend}
                onBlock={handleBlock}
                contextMenu={contextMenu}
                setContextMenu={setContextMenu}
              />
            )}
            {activeTab === "requests" && (
              <RequestsTab
                incoming={safeIncoming}
                outgoing={safeOutgoing}
                onAccept={handleAccept}
                onReject={handleReject}
                onCancel={handleCancel}
              />
            )}
            {activeTab === "find" && (
              <FindTab
                searchQuery={searchQuery}
                onSearch={handleSearch}
                searchResults={safeSearchResults}
                friendCodeInput={friendCodeInput}
                setFriendCodeInput={setFriendCodeInput}
                onSendByCode={handleSendRequestByCode}
                onSendById={handleSendRequestById}
              />
            )}
            {activeTab === "blocked" && (
              <BlockedTab blocked={safeBlocked} onUnblock={handleUnblock} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <FriendProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
}

// ==================== Sub-Components ====================

function FriendsTab({
  friends,
  loading,
  onViewProfile,
  onRemove,
  onBlock,
  contextMenu,
  setContextMenu,
}: any) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[var(--accent-color-dynamic)]" />
      </div>
    );
  }

  if (!friends.length) {
    return (
      <div className="text-center py-20">
        <Users size={48} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-400">No friends yet</h3>
        <p className="text-gray-500 mt-2">
          Share your friend code or search for users to connect!
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {friends.map((friend: any) => (
        <div
          key={friend.userId || friend._id}
          className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:border-[var(--accent-color-dynamic)]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-[var(--accent-color-dynamic)]/30 rounded-full flex items-center justify-center text-[var(--accent-color-dynamic)] font-bold">
                {(friend.name || friend.displayName || "?")[0].toUpperCase()}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${
                  statusColors[friend.onlineStatus] || statusColors.offline
                }`}
              />
            </div>
            <div>
              <p className="font-medium">{friend.name || friend.displayName}</p>
              <p className="text-xs text-gray-500">
                {friend.onlineStatus === "studying"
                  ? "Currently studying"
                  : friend.onlineStatus === "online"
                    ? "Online"
                    : "Offline"}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() =>
                setContextMenu(
                  contextMenu === (friend.userId || friend._id)
                    ? null
                    : friend.userId || friend._id,
                )
              }
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreVertical size={16} />
            </button>
            {contextMenu === (friend.userId || friend._id) && (
              <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 w-48">
                <button
                  onClick={() => onViewProfile(friend.userId || friend._id)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                >
                  <Users size={14} /> View Profile
                </button>
                <button
                  onClick={() => onRemove(friend.userId || friend._id)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-[var(--accent-color-dynamic)] flex items-center gap-2"
                >
                  <UserMinus size={14} /> Remove Friend
                </button>
                <button
                  onClick={() => onBlock(friend.userId || friend._id)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-[var(--accent-color-dynamic)] rounded-b-lg flex items-center gap-2"
                >
                  <Shield size={14} /> Block User
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestsTab({ incoming, outgoing, onAccept, onReject, onCancel }: any) {
  return (
    <div className="space-y-6">
      {/* Incoming */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <UserPlus size={18} /> Incoming Requests
          {incoming.length > 0 && (
            <span className="text-sm bg-[var(--accent-color-dynamic)]/30 text-[var(--accent-color-dynamic)] px-2 py-0.5 rounded-full">
              {incoming.length}
            </span>
          )}
        </h3>
        {incoming.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending requests</p>
        ) : (
          <div className="grid gap-3">
            {incoming.map((req: any) => (
              <div
                key={req._id}
                className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--accent-color-dynamic)]/30 rounded-full flex items-center justify-center text-[var(--accent-color-dynamic)] font-bold">
                    {(req.requesterName || req.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">
                      {req.requesterName || req.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      <Clock size={10} className="inline mr-1" />
                      {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAccept(req.friendshipId)}
                    className="p-2 bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] rounded-lg hover:bg-[var(--accent-color-dynamic)]/30 transition-colors"
                    title="Accept"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => onReject(req.friendshipId)}
                    className="p-2 bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] rounded-lg hover:bg-[var(--accent-color-dynamic)]/30 transition-colors"
                    title="Reject"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock size={18} /> Outgoing Requests
        </h3>
        {outgoing.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending outgoing requests</p>
        ) : (
          <div className="grid gap-3">
            {outgoing.map((req: any) => (
              <div
                key={req._id}
                className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-600/30 rounded-full flex items-center justify-center text-gray-400 font-bold">
                    {(req.recipientName || req.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">
                      {req.recipientName || req.name}
                    </p>
                    <p className="text-xs text-gray-500">Pending...</p>
                  </div>
                </div>
                <button
                  onClick={() => onCancel(req.friendshipId)}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FindTab({
  searchQuery,
  onSearch,
  searchResults,
  friendCodeInput,
  setFriendCodeInput,
  onSendByCode,
  onSendById,
}: any) {
  return (
    <div className="space-y-6">
      {/* Friend Code */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Add by Friend Code</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={friendCodeInput}
            onChange={(e: any) => setFriendCodeInput(e.target.value.toUpperCase())}
            placeholder="Enter friend code (e.g., A1B2C3D4)"
            maxLength={8}
            className="flex-1 bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-[var(--accent-color-dynamic)] focus:outline-none font-mono tracking-wider"
          />
          <button
            onClick={onSendByCode}
            disabled={!friendCodeInput.trim()}
            className="px-6 py-2 bg-[var(--accent-color-dynamic)] text-white rounded-lg hover:bg-[var(--accent-color-dynamic)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Request
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Search Users</h3>
        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={onSearch}
            placeholder="Search by name or email..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-[var(--accent-color-dynamic)] focus:outline-none"
          />
        </div>

        {searchResults.length === 0 && searchQuery.length >= 2 && (
          <p className="text-gray-500 text-center py-8">No users found</p>
        )}

        <div className="grid gap-3">
          {searchResults.map((u: any) => (
            <div
              key={u._id || u.userId}
              className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--accent-color-dynamic)]/30 rounded-full flex items-center justify-center text-[var(--accent-color-dynamic)] font-bold">
                  {(u.displayName || u.name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{u.displayName || u.name}</p>
                  {u.bio && (
                    <p className="text-xs text-gray-500 truncate max-w-xs">
                      {u.bio}
                    </p>
                  )}
                </div>
              </div>
              {u.friendshipStatus === "accepted" ? (
                <span className="text-sm text-[var(--accent-color-dynamic)] flex items-center gap-1">
                  <Check size={14} /> Friends
                </span>
              ) : u.friendshipStatus === "pending" ? (
                <span className="text-sm text-[var(--accent-color-dynamic)] flex items-center gap-1">
                  <Clock size={14} /> Pending
                </span>
              ) : (
                <button
                  onClick={() => onSendById(u._id || u.userId)}
                  className="px-4 py-1.5 text-sm bg-[var(--accent-color-dynamic)] text-white rounded-lg hover:bg-[var(--accent-color-dynamic)] transition-colors"
                >
                  Add Friend
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockedTab({ blocked, onUnblock }: any) {
  if (!blocked.length) {
    return (
      <div className="text-center py-20">
        <Shield size={48} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-400">
          No blocked users
        </h3>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {blocked.map((u: any) => (
        <div
          key={u._id || u.userId}
          className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded-lg p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--accent-color-dynamic)]/30 rounded-full flex items-center justify-center text-[var(--accent-color-dynamic)] font-bold">
              {(u.name || u.displayName || "?")[0].toUpperCase()}
            </div>
            <p className="font-medium">{u.name || u.displayName}</p>
          </div>
          <button
            onClick={() => onUnblock(u.userId || u._id)}
            className="px-4 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Unblock
          </button>
        </div>
      ))}
    </div>
  );
}

export default Friends;
