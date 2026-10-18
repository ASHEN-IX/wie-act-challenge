import { create } from "zustand";
import { friendsAPI, teamSessionsAPI } from "../services/api";

export interface FriendsState {
  friends: any[];
  incomingRequests: any[];
  outgoingRequests: any[];
  blockedUsers: any[];
  onlineFriends: any[];
  searchResults: any[];
  friendCount: number;
  selectedFriend: any;
  loading: boolean;
  error: string | null;
  activeTeamSession: any;
  teamParticipants: any[];
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  fetchFriends: () => Promise<void>;
  fetchIncomingRequests: () => Promise<void>;
  fetchOutgoingRequests: () => Promise<void>;
  fetchBlocked: () => Promise<void>;
  fetchOnlineFriends: () => Promise<void>;
  fetchFriendCount: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  sendRequest: (data: any) => Promise<any>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  setSelectedFriend: (friend: any) => void;
  setActiveTeamSession: (session: any) => void;
  setTeamParticipants: (participants: any[]) => void;
  [key: string]: any;
}

export type UseFriendsStore = {
  (): FriendsState;
  <U>(selector: (state: FriendsState) => U): U;
  getState: () => FriendsState;
  setState: any;
  subscribe: any;
};
export const useFriendsStore = create<any>((set: any, get: any) => ({
  // State
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blockedUsers: [],
  onlineFriends: [],
  searchResults: [],
  friendCount: 0,
  selectedFriend: null,
  loading: false,
  error: null,

  // Team session state
  activeTeamSession: null,
  teamParticipants: [],

  // Actions
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: any) => set({ error }),
  clearError: () => set({ error: null }),

  // Fetch friends list
  fetchFriends: async () => {
    set({ loading: true, error: null });
    try {
      const data = await friendsAPI.getAll();
      const friendsArray = Array.isArray(data.friends)
        ? data.friends
        : Array.isArray(data)
          ? data
          : [];
      set({ friends: friendsArray, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to load friends",
        loading: false,
      });
    }
  },

  // Fetch incoming requests
  fetchIncomingRequests: async () => {
    try {
      const data = await friendsAPI.getIncoming();
      const requestsArray = Array.isArray(data.requests)
        ? data.requests
        : Array.isArray(data)
          ? data
          : [];
      set({ incomingRequests: requestsArray });
    } catch (err: any) {
      console.error("Failed to fetch incoming requests:", err);
      set({ incomingRequests: [] });
    }
  },

  // Fetch outgoing requests
  fetchOutgoingRequests: async () => {
    try {
      const data = await friendsAPI.getOutgoing();
      const requestsArray = Array.isArray(data.requests)
        ? data.requests
        : Array.isArray(data)
          ? data
          : [];
      set({ outgoingRequests: requestsArray });
    } catch (err: any) {
      console.error("Failed to fetch outgoing requests:", err);
      set({ outgoingRequests: [] });
    }
  },

  // Fetch blocked users
  fetchBlocked: async () => {
    try {
      const data = await friendsAPI.getBlocked();
      const blockedArray = Array.isArray(data.blocked)
        ? data.blocked
        : Array.isArray(data)
          ? data
          : [];
      set({ blockedUsers: blockedArray });
    } catch (err: any) {
      console.error("Failed to fetch blocked users:", err);
      set({ blockedUsers: [] });
    }
  },

  // Fetch online friends
  fetchOnlineFriends: async () => {
    try {
      const data = await friendsAPI.getOnline();
      const onlineArray = Array.isArray(data.friends)
        ? data.friends
        : Array.isArray(data)
          ? data
          : [];
      set({ onlineFriends: onlineArray });
    } catch (err: any) {
      console.error("Failed to fetch online friends:", err);
      set({ onlineFriends: [] });
    }
  },

  // Fetch friend count
  fetchFriendCount: async () => {
    try {
      const data = await friendsAPI.getCount();
      set({ friendCount: data.total || data.count || 0 });
    } catch (err: any) {
      console.error("Failed to fetch friend count:", err);
    }
  },

  // Search users
  searchUsers: async (query: string) => {
    if (!query || query.length < 2) {
      set({ searchResults: [] });
      return;
    }
    try {
      const data = await friendsAPI.search(query);
      const resultsArray = Array.isArray(data.users)
        ? data.users
        : Array.isArray(data)
          ? data
          : [];
      set({ searchResults: resultsArray });
    } catch (err: any) {
      console.error("Search failed:", err);
      set({ searchResults: [] });
    }
  },

  // Send friend request
  sendRequest: async (data: any) => {
    try {
      const result = await friendsAPI.sendRequest(data);
      // Refresh outgoing requests
      get().fetchOutgoingRequests();
      return result;
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to send request";
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // Accept friend request
  acceptRequest: async (requestId: string) => {
    try {
      await friendsAPI.acceptRequest(requestId);
      get().fetchFriends();
      get().fetchIncomingRequests();
      get().fetchFriendCount();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to accept request" });
    }
  },

  // Reject friend request
  rejectRequest: async (requestId: string) => {
    try {
      await friendsAPI.rejectRequest(requestId);
      set((s: any) => ({
        incomingRequests: s.incomingRequests.filter((r: any) => r._id !== requestId),
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to reject request" });
    }
  },

  // Cancel outgoing request
  cancelRequest: async (requestId: string) => {
    try {
      await friendsAPI.cancelRequest(requestId);
      set((s: any) => ({
        outgoingRequests: s.outgoingRequests.filter((r: any) => r._id !== requestId),
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to cancel request" });
    }
  },

  // Remove friend
  removeFriend: async (friendId: string) => {
    try {
      await friendsAPI.removeFriend(friendId);
      set((s: any) => ({
        friends: s.friends.filter(
          (f: any) => f.friendId !== friendId && f._id !== friendId,
        ),
        friendCount: Math.max(0, s.friendCount - 1),
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to remove friend" });
    }
  },

  // Block user
  blockUser: async (userId: string) => {
    try {
      await friendsAPI.blockUser(userId);
      get().fetchFriends();
      get().fetchBlocked();
      get().fetchFriendCount();
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to block user" });
    }
  },

  // Unblock user
  unblockUser: async (userId: string) => {
    try {
      await friendsAPI.unblockUser(userId);
      set((s: any) => ({
        blockedUsers: s.blockedUsers.filter(
          (b: any) => b.userId !== userId && b._id !== userId,
        ),
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to unblock user" });
    }
  },

  // Get friend profile
  getFriendProfile: async (friendId: any) => {
    try {
      const data = await friendsAPI.getProfile(friendId);
      set({ selectedFriend: data.profile || data });
      return data.profile || data;
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to load profile" });
    }
  },

  // Team session actions
  createTeamSession: async (data: any) => {
    try {
      const result = await teamSessionsAPI.create(data);
      set({ activeTeamSession: result.session || result });
      return result;
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to create team session",
      });
      throw err;
    }
  },

  joinTeamSession: async (sessionId: any, inviteCode: any) => {
    try {
      const result = await teamSessionsAPI.join(sessionId, inviteCode);
      set({ activeTeamSession: result.session || result });
      return result;
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to join session" });
      throw err;
    }
  },

  leaveTeamSession: async (sessionId: any) => {
    try {
      await teamSessionsAPI.leave(sessionId);
      set({ activeTeamSession: null, teamParticipants: [] });
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to leave session" });
    }
  },

  inviteToSession: async (sessionId: any, friendId: any) => {
    try {
      return await teamSessionsAPI.invite(sessionId, friendId);
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to send invite" });
      throw err;
    }
  },

  fetchParticipants: async (sessionId: any) => {
    try {
      const data = await teamSessionsAPI.getParticipants(sessionId);
      set({ teamParticipants: data.participants || [] });
    } catch (err: any) {
      console.error("Failed to fetch participants:", err);
    }
  },

  endTeamSession: async (sessionId: any) => {
    try {
      const result = await teamSessionsAPI.end(sessionId);
      set({ activeTeamSession: null, teamParticipants: [] });
      return result;
    } catch (err: any) {
      set({ error: err.response?.data?.error || "Failed to end session" });
      throw err;
    }
  },
}));



export default useFriendsStore as unknown as UseFriendsStore;
