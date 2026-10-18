import React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  AlertTriangle,
  Clock,
  BookOpen,
  Target,
  Zap,
  Trophy,
  Calendar,
  Swords,
} from "lucide-react";
import useNotificationStore from "../store/notificationStore";

const NotificationItem = ({ notification }: any) => {
  const { markAsRead } = useNotificationStore();

  const getIcon = (type: any) => {
    const iconProps = { size: 20 };

    switch (type) {
      case "study_reminder":
        return (
          <Clock
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "break_suggestion":
        return (
          <Zap {...iconProps} className="text-[var(--accent-color-dynamic)]" />
        );
      case "plan_generated":
        return (
          <Target
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "task_due":
        return (
          <Calendar
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "session_suspended":
        return (
          <AlertTriangle
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "fatigue_alert":
        return (
          <AlertTriangle
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "focus_drop":
        return (
          <BookOpen
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "achievement":
        return (
          <Trophy
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "schedule_change":
        return (
          <Calendar
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "team_invite":
        return (
          <Swords
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      case "team_join":
        return (
          <Swords
            {...iconProps}
            className="text-[var(--accent-color-dynamic)]"
          />
        );
      default:
        return <Bell {...iconProps} className="text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: any) => {
    switch (priority) {
      case "urgent":
      case "high":
      case "normal":
        return "border-l-[var(--accent-color-dynamic)] bg-[var(--accent-color-dynamic)]/10 dark:bg-[var(--accent-color-dynamic)]/20";
      default:
        return "border-l-gray-500 bg-gray-50 dark:bg-gray-900/20";
    }
  };

  const handleClick = () => {
    if (notification.status === "unread") {
      markAsRead(notification._id);
    }
  };

  return (
    <div
      className={`p-4 border-l-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
        notification.status === "unread"
          ? `${getPriorityColor(notification.priority)} border-r-2 border-r-current`
          : "bg-background/40 dark:bg-gray-800/40 backdrop-blur-md border-l-gray-300/50 dark:border-l-gray-600/50"
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h4
              className={`text-sm font-semibold truncate ${
                notification.status === "unread"
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {notification.title}
            </h4>

            {notification.status === "unread" && (
              <div className="w-2 h-2 bg-current rounded-full flex-shrink-0 ml-2"></div>
            )}
          </div>

          <p
            className={`text-sm mt-1 ${
              notification.status === "unread"
                ? "text-gray-700 dark:text-gray-300"
                : "text-gray-500 dark:text-gray-500"
            }`}
          >
            {notification.message}
          </p>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
              })}
            </span>

            <span
              className={`text-xs px-2 py-1 rounded-full capitalize ${
                notification.priority === "urgent"
                  ? "bg-[var(--accent-color-dynamic)]/15 text-[var(--accent-color-dynamic)] dark:bg-[var(--accent-color-dynamic)] dark:text-[var(--accent-color-dynamic)]"
                  : notification.priority === "high"
                    ? "bg-[var(--accent-color-dynamic)]/15 text-[var(--accent-color-dynamic)] dark:bg-[var(--accent-color-dynamic)]/20 dark:text-[var(--accent-color-dynamic)]"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {notification.priority}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
