import React, { useEffect, useRef } from "react";
import { X, CheckCheck } from "lucide-react";
import useNotificationStore from "../store/notificationStore";
import { useAuthStore } from "../store/authStore";
import NotificationItem from "./NotificationItem";

const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    isOpen,
    closeNotificationCenter,
    markAllAsRead,
    fetchNotifications,
  } = useNotificationStore();

  const { user } = useAuthStore();
  const dropdownRef = useRef<any>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeNotificationCenter();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeNotificationCenter]);

  // Fetch notifications when component mounts or user changes
  useEffect(() => {
    if (user?._id && isOpen) {
      fetchNotifications(user._id);
    }
  }, [user?._id, isOpen, fetchNotifications]);

  const handleMarkAllAsRead = async () => {
    if (user?._id && unreadCount > 0) {
      await markAllAsRead(user._id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
      <div
        ref={dropdownRef}
        className="w-full max-w-sm bg-background/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/10 dark:border-white/5 pointer-events-auto max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="bg-[var(--accent-color-dynamic)] text-white text-xs font-bold rounded-full px-2 py-1">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-sm text-[var(--accent-color-dynamic)] hover:text-[var(--accent-color-dynamic)] dark:text-[var(--accent-color-dynamic)] dark:hover:text-[var(--accent-color-dynamic)] transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={16} />
                Mark all read
              </button>
            )}

            <button
              onClick={closeNotificationCenter}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Close"
            >
              <X size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color-dynamic)]"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-[var(--accent-color-dynamic)] dark:text-[var(--accent-color-dynamic)]">
              <p>Failed to load notifications</p>
              <button
                onClick={() => user?._id && fetchNotifications(user._id)}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">🔔</div>
              <p>No notifications yet</p>
              <p className="text-sm mt-1">
                We'll notify you when something important happens!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Showing {notifications.length} notification
              {notifications.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
