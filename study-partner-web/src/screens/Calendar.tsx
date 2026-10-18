'use client';
import React, { useState, useEffect } from "react";
import { useSearchParams } from "@/navigation";
import WeeklyCalendar from "../components/WeeklyCalendar";
import { availabilityAPI, studyPlanAPI } from "../services/api";
import "./Calendar.css";

const Calendar = () => {
  const [searchParams] = useSearchParams();
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [weeksView] = useState(1);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  useEffect(() => {
    fetchAvailability();
    fetchCalendarEntries(weeksView);

    // Show success message if coming from scheduler
    if (searchParams?.get("refresh") === "true") {
      showSuccess(
        "📅 Study plan scheduled successfully! Your sessions are now visible on the calendar.",
      );
    }
  }, []);

  // Refresh events when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchScheduledSessions();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    // refetch when weeksView or currentWeekStart changes
    fetchCalendarEntries(weeksView);
  }, [weeksView, currentWeekStart]);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const data = await availabilityAPI.get();
      setAvailability(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching availability:", err);
      setError("Failed to load your schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledSessions = async () => {
    try {
      // Load scheduled study plans and fetch their schedule view
      const resp = await studyPlanAPI.getAll({ status: "scheduled" });
      const plans = resp.data.plans || [];
      const allSessions: any[] = [];
      for (const plan of plans) {
        try {
          const scheduleResp = await studyPlanAPI.getSchedule(plan.id);
          const schedule =
            scheduleResp.data.schedule || scheduleResp.data || null;
          if (schedule && schedule.sessions) {
            // Attach plan id to each session and push
            schedule.sessions.forEach((s: any) =>
              allSessions.push({ ...s, planId: plan.id }),
            );
          }
        } catch (e: any) {
          console.warn(
            "Failed to fetch schedule for plan",
            plan.id,
            e.message || e,
          );
        }
      }
      setEvents(allSessions);
    } catch (err: any) {
      console.error("Error fetching scheduled sessions:", err);
    }
  };

  const fetchCalendarEntries = async (weeks = 2) => {
    try {
      const resp = await studyPlanAPI.getCalendar({
        weeks,
        startDate: currentWeekStart.toISOString(),
      });

      const entries = resp.data.entries || [];

      // Normalize entries to the shape expected by WeeklyCalendar
      const mapped = entries.map((e: any) => ({
        id: e._id || `${e.userId}-${e.startTime}`,
        taskId: e.taskId,
        title: e.title,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        estimatedMinutes: e.estimatedMinutes,
        planId: e.planId,
        source: e.source,
        status: e.status,
      }));

      setEvents(mapped);
    } catch (err: any) {
      console.error("Error fetching calendar entries:", err);

      if (err.response?.status === 401) {
        setError(
          "Your session has expired. Please sign in again.",
        );
      } else if (err.response?.status === 500) {
        setError("Server error. Check backend logs for details.");
      } else {
        setError("Failed to load calendar events. Check console for details.");
      }
    }
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  const formatWeekRange = () => {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + weeksView * 7 - 1);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    return `${currentWeekStart.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
  };

  const handleSaveSlot = async (slotData: any) => {
    try {
      const newSlot = await availabilityAPI.save(slotData);
      setAvailability([...availability, newSlot]);
      showSuccess("Time slot blocked successfully! ✅");
    } catch (err: any) {
      console.error("Error saving slot:", err);
      setError("Failed to save time slot. Please try again.");
    }
  };

  const handleDeleteSlot = async (slotId: any) => {
    try {
      await availabilityAPI.delete(slotId);
      setAvailability(availability.filter((slot) => slot._id !== slotId));
      showSuccess("Time slot removed successfully! 🗑️");
    } catch (err: any) {
      console.error("Error deleting slot:", err);
      setError("Failed to delete time slot. Please try again.");
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm("Are you sure you want to clear your entire schedule?")
    ) {
      return;
    }

    try {
      // Delete all slots
      await Promise.all(
        availability.map((slot) => availabilityAPI.delete(slot._id)),
      );
      setAvailability([]);
      showSuccess("Schedule cleared successfully! 🧹");
    } catch (err: any) {
      console.error("Error clearing schedule:", err);
      setError("Failed to clear schedule. Please try again.");
    }
  };

  const showSuccess = (message: any) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const getFreeHours = () => {
    const totalHours = 7 * 14; // 7 days * 14 hours (7 AM to 9 PM)
    const blockedHours = availability.reduce((sum: any, slot: any) => {
      const start = parseInt(slot.start_time.split(":")[0]);
      const end = parseInt(slot.end_time.split(":")[0]);
      return sum + (end - start);
    }, 0);
    return totalHours - blockedHours;
  };

  return (
    <div className="calendar-page">
      <div className="calendar-container">
        <div className="calendar-header-section">
          <div className="header-content">
            <h1 className="page-title">📅 Weekly Schedule</h1>
          </div>

          <div className="stats-panel">
            <div className="stat-card">
              <div className="stat-value">{availability.length}</div>
              <div className="stat-label">Blocked Slots</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{events.length}</div>
              <div className="stat-label">Study Sessions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{getFreeHours()}h</div>
              <div className="stat-label">Free Time/Week</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
            <button className="alert-close" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <span className="alert-icon">✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your schedule...</p>
          </div>
        ) : (
          <>
            <div className="week-navigation">
              <button className="nav-btn" onClick={goToPreviousWeek}>
                ⬅️ Previous
              </button>
              <button
                className="nav-btn current-week"
                onClick={goToCurrentWeek}
              >
                📅 Current Week
              </button>
              <button className="nav-btn" onClick={goToNextWeek}>
                Next ➡️
              </button>
              <div className="week-range">{formatWeekRange()}</div>
            </div>

            <WeeklyCalendar
              availability={availability}
              events={events}
              currentWeekStart={currentWeekStart}
              weeksView={weeksView}
              onSave={handleSaveSlot}
              onDelete={handleDeleteSlot}
            />

            <div className="calendar-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  fetchAvailability();
                  fetchCalendarEntries(weeksView);
                }}
              >
                🔄 Refresh All
              </button>
              <button className="btn-danger" onClick={handleClearAll}>
                🗑️ Clear All
              </button>
            </div>

            <div className="info-panel">
              <h3>💡 How It Works</h3>
              <ol>
                <li>
                  <strong>Click time slots</strong> to block your busy times
                  (classes, work, etc.)
                </li>
                <li>
                  <strong>Label each block</strong> so you know what's scheduled
                </li>
                <li>
                  <strong>The AI scheduler</strong> will automatically fill your
                  free time with study sessions
                </li>
                <li>
                  <strong>Update anytime</strong> - your schedule adapts
                  automatically
                </li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Calendar;
