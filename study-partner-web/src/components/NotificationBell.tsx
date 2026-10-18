import React from "react";
import { Bell } from "lucide-react";
import useNotificationStore from "../store/notificationStore";

const NotificationBell = () => {
  const { unreadCount, toggleNotificationCenter } = useNotificationStore();

  return (
    <button
      onClick={toggleNotificationCenter}
      className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <Bell size={20} className="text-gray-600 dark:text-gray-300" />

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-[var(--accent-color-dynamic)] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
