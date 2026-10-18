import { create } from "zustand";
import { notificationAPI } from "../services/api";
const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window === "undefined" ? "" : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`);

export interface NotificationItem {
  _id: string;
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  status?: string;
  readAt?: Date;
  createdAt?: string | Date;
  data?: any;
  [key: string]: any;
}

export interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  unavailableUntil: number | null;
  isOpen: boolean;
  ws: WebSocket | null;
  pollingInterval: any;
  pendingInvites: any[];
  sessionStartSignal: any;
  fetchNotifications: (userId?: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  initWebSocket: (userId: string) => void;
  closeWebSocket: () => void;
  startPolling: (userId?: string, intervalMs?: number) => void;
  stopPolling: () => void;
  addPendingInvite: (invite: any) => void;
  removePendingInvite: (sessionId: string) => void;
  setSessionStartSignal: (signal: any) => void;
  clearSessionStartSignal: () => void;
  toggleNotificationCenter?: any;
  closeNotificationCenter?: any;
  markAllAsRead?: any;
  dismissInvite?: any;
  [key: string]: any;
}

export type UseNotificationStore = {
  (): NotificationState;
  <U>(selector: (state: NotificationState) => U): U;
  getState: () => NotificationState;
  setState: any;
  subscribe: any;
};
export const useNotificationStore = create<any>((set: any, get: any) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  unavailableUntil: null,
  isOpen: false,
  ws: null,
  pollingInterval: null,
  pendingInvites: [],
  sessionStartSignal: null, // { sessionId, inviteCode } when leader fires start

  // Actions
  fetchNotifications: async (userId: any) => {
    const unavailableUntil = get().unavailableUntil;
    if (unavailableUntil && Date.now() < unavailableUntil) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const data = await notificationAPI.getAll({ userId });
      const notifications = data.notifications || [];
      const unreadCount = data.unreadCount || 0;

      set({
        notifications,
        unreadCount,
        isLoading: false,
        unavailableUntil: null,
      });
    } catch (error: any) {
      const status = error.response?.status;

      // Silently fail for unimplemented endpoints
      if (status !== 404 && ![500, 502, 503, 504].includes(status)) {
        console.error("Failed to fetch notifications:", error);
        set({
          error: error.message,
          isLoading: false,
        });
      } else {
        set({
          isLoading: false,
          // Back off polling briefly when notifications service is degraded.
          unavailableUntil:
            status === 503
              ? Date.now() + 2 * 60 * 1000
              : get().unavailableUntil,
        });
      }
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationAPI.markRead(notificationId);

      // Update local state
      const notifications = get().notifications.map((notification: NotificationItem) =>
        notification._id === notificationId
          ? { ...notification, status: "read", readAt: new Date() }
          : notification,
      );

      const unreadCount = Math.max(0, get().unreadCount - 1);

      set({ notifications, unreadCount });
    } catch (error: any) {
      console.error("Failed to mark notification as read:", error);
    }
  },

  markAllAsRead: async (userId: any) => {
    try {
      await notificationAPI.markAllRead(userId);

      // Update local state
      const notifications = get().notifications.map((notification: NotificationItem) => ({
        ...notification,
        status: "read",
        readAt: new Date(),
      }));

      set({ notifications, unreadCount: 0 });
    } catch (error: any) {
      console.error("Failed to mark all notifications as read:", error);
    }
  },

  addNotification: (notification: NotificationItem) => {
    const notifications = [notification, ...get().notifications];
    const unreadCount =
      notification.status === "unread"
        ? get().unreadCount + 1
        : get().unreadCount;

    // Add to pendingInvites if it's a team_invite
    let pendingInvites = get().pendingInvites;
    if (
      notification.type === "team_invite" &&
      notification.status === "unread"
    ) {
      const alreadyQueued = pendingInvites.some(
        (inv: any) => inv._id === notification._id,
      );
      if (!alreadyQueued) {
        pendingInvites = [...pendingInvites, notification];
      }
    }

    set({ notifications, unreadCount, pendingInvites });
  },

  toggleNotificationCenter: () => {
    set({ isOpen: !get().isOpen });
  },

  closeNotificationCenter: () => {
    set({ isOpen: false });
  },

  dismissInvite: async (notificationId: any) => {
    await get().markAsRead(notificationId);
    const pendingInvites = get().pendingInvites.filter(
      (inv: any) => inv._id !== notificationId,
    );
    set({ pendingInvites });
  },

  // Connect WebSocket with polling fallback
  startPolling: (userId: any = null, intervalMs: number = 30000) => {
    // Initial fetch
    get().fetchNotifications(userId);

    // Try WebSocket first
    try {
      const wsUrl = `${WS_BASE}/ws/notifications?userId=${userId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Clear polling if it was started as fallback
        const { pollingInterval } = get();
        if (pollingInterval) {
          clearInterval(pollingInterval);
          set({ pollingInterval: null });
        }
      };

      ws.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_notification" && data.notification) {
            get().addNotification(data.notification);
          } else if (data.type === "session_start") {
            // Leader triggered start — push all members to study session
            set({
              sessionStartSignal: {
                sessionId: data.sessionId,
                inviteCode: data.inviteCode,
              },
            });
          }
        } catch (err: any) {
          console.warn("[Notifications] Failed to parse WS message:", err);
        }
      };

      ws.onclose = () => {
        set({ ws: null });
        // Fallback to polling
        if (!get().pollingInterval) {
          const id = setInterval(
            () => get().fetchNotifications(userId),
            intervalMs,
          );
          set({ pollingInterval: id });
        }
      };

      ws.onerror = (err: any) => {
        console.warn(
          "[Notifications] WebSocket error, will fallback to polling",
        );
      };

      set({ ws });
    } catch (e) {
      console.warn("[Notifications] WebSocket not available, using polling");
    }

    // Start polling as initial fallback (will be cleared if WS connects)
    const intervalId = setInterval(
      () => get().fetchNotifications(userId),
      intervalMs,
    );
    set({ pollingInterval: intervalId });

    return () => {
      const { ws, pollingInterval } = get();
      if (ws) {
        ws.close();
        set({ ws: null });
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
        set({ pollingInterval: null });
      }
    };
  },

  stopPolling: () => {
    const { ws, pollingInterval } = get();
    if (ws) {
      ws.close();
      set({ ws: null });
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },

  clearSessionStartSignal: () => set({ sessionStartSignal: null }),
}));



export default useNotificationStore as unknown as UseNotificationStore;
