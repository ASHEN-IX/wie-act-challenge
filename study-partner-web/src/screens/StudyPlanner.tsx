'use client';
import React, { useState, useEffect, useCallback } from "react";
import { studyPlanAPI, tasksAPI, availabilityAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import WeeklyCalendar from "../components/WeeklyCalendar";
import "./StudyPlanner.css";

const StudyPlanner = () => {
  const user = useAuthStore((state) => state.user);

  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState<any>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const weeksView = 1;

  // Initialize to start of current week (Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const fetchScheduledSessions = useCallback(async () => {
    try {
      const resp = await studyPlanAPI.getCalendar({
        weeks: weeksView,
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
      console.error("✗ StudyPlanner: Error fetching calendar entries:", err);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    fetchAvailability();
    fetchScheduledSessions();
    fetchTasks();
  }, [user, currentWeekStart, fetchScheduledSessions]);

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

  const fetchTasks = async () => {
    try {
      const response = await tasksAPI.getAll();
      // Filter for pending tasks (todo and in-progress) on client side
      const pendingTasks = (response.data.tasks || []).filter(
        (task: any) => task.status === "todo" || task.status === "in-progress",
      );
      setTasks(pendingTasks);
    } catch (error: any) {
      console.error("Failed to load tasks:", error);
    }
  };

  const fetchAvailability = async () => {
    try {
      const data = await availabilityAPI.get();
      setAvailability(data);
    } catch (err: any) {
      console.error("Error fetching availability:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlot = async (slotData: any) => {
    try {
      const newSlot = await availabilityAPI.save(slotData);
      setAvailability([...availability, newSlot]);
    } catch (err: any) {
      console.error("Error saving slot:", err);
    }
  };

  const handleDeleteSlot = async (slotId: any) => {
    try {
      await availabilityAPI.delete(slotId);
      setAvailability(availability.filter((slot) => slot._id !== slotId));
    } catch (err: any) {
      console.error("Error deleting slot:", err);
    }
  };

  const handleGenerateSchedule = async () => {
    setScheduling(true);
    setError(null);
    setSuccess(null);

    try {
      // Helper function to convert availability slots to calendar events
      const convertAvailabilityToEvents = (slots: any) => {
        if (!slots || slots.length === 0) return [];

        const events: any[] = [];
        const now = new Date();

        // Get start of current week (Monday)
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ...
        const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        monday.setHours(0, 0, 0, 0);

        // Map day names to day indices (0 = Monday, 6 = Sunday)
        const dayMap: Record<string, number> = {
          Monday: 0,
          Tuesday: 1,
          Wednesday: 2,
          Thursday: 3,
          Friday: 4,
          Saturday: 5,
          Sunday: 6,
        };

        slots.forEach((slot: any) => {
          try {
            const dayIndex = dayMap[slot.day_of_week];
            if (dayIndex === undefined) {
              console.warn("Invalid day_of_week:", slot.day_of_week);
              return;
            }

            // Calculate the date for this day of the week
            const slotDate = new Date(monday);
            slotDate.setDate(monday.getDate() + dayIndex);

            // Parse start and end times
            const [startHour, startMin] = slot.start_time
              .split(":")
              .map(Number);
            const [endHour, endMin] = slot.end_time.split(":").map(Number);

            // Create start datetime
            const startTime = new Date(slotDate);
            startTime.setHours(startHour, startMin || 0, 0, 0);

            // Create end datetime
            const endTime = new Date(slotDate);
            endTime.setHours(endHour, endMin || 0, 0, 0);

            events.push({
              start: startTime.toISOString(),
              end: endTime.toISOString(),
              title: slot.label || "Busy",
            });
          } catch (err: any) {
            console.error("Error converting slot:", slot, err);
          }
        });

        return events;
      };

      // Convert availability slots to calendar events
      const calendarEvents = convertAvailabilityToEvents(availability);

      // Call the schedule-tasks endpoint
      const response = await studyPlanAPI.scheduleTasks({
        calendarEvents: calendarEvents,
        maxMinutesPerDay: 240,
        allowLateNight: false,
      });

      const schedule = response.data.schedule;

      // Note: Sessions are already saved to calendar by the backend
      // Refresh calendar entries from database to show all events
      await fetchScheduledSessions();

      setSuccess(
        `✓ Successfully scheduled ${schedule.sessions.length} tasks across ${schedule.spanDays} days!`,
      );
    } catch (error: any) {
      setError(
        error.response?.data?.error ||
          error.response?.data?.details ||
          "Failed to generate schedule",
      );
      console.error("Schedule generation error:", error);
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl font-bold tracking-wider">
          LOADING SCHEDULE...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-wider uppercase">
                <span className="text-primary">{"//"}</span> STUDY SCHEDULE
              </h1>
              <p className="text-white/60 mt-2">
                {tasks.length > 0 ? (
                  `Schedule your ${tasks.length} pending task${tasks.length !== 1 ? "s" : ""} with AI`
                ) : (
                  <>
                    Create tasks first, then schedule them with AI.{" "}
                    <a href="/tasks" className="text-primary hover:underline">
                      Go to Tasks →
                    </a>
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleGenerateSchedule}
                disabled={scheduling || tasks.length === 0}
                className="px-6 py-3 bg-primary hover:bg-primary/80 transition-all duration-300 font-bold tracking-wider text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  tasks.length === 0
                    ? "Create some tasks first"
                    : "Generate AI-powered schedule"
                }
              >
                {scheduling ? "GENERATING..." : "GENERATE SCHEDULE"}
              </button>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mt-4 p-4 bg-[var(--accent-color-dynamic)]/20 border-2 border-[var(--accent-color-dynamic)] text-[var(--accent-color-dynamic)] font-bold">
              {success}
            </div>
          )}
          {error && (
            <div className="mt-4 p-4 bg-destructive/20 border-2 border-destructive text-destructive font-bold">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Calendar Section */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
          <button
            className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/20 text-white font-medium transition-colors"
            onClick={goToPreviousWeek}
          >
            Previous
          </button>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium transition-colors"
            onClick={goToCurrentWeek}
          >
            Current Week
          </button>
          <button
            className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/20 text-white font-medium transition-colors"
            onClick={goToNextWeek}
          >
            Next
          </button>
          <div className="px-4 py-2 bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg font-semibold min-w-[200px] text-center text-white">
            {formatWeekRange()}
          </div>

          <div className="px-3 py-1 rounded bg-white/10 border border-white/10 text-white/70 text-sm">
            Single week view
          </div>
        </div>

        <WeeklyCalendar
          availability={availability}
          events={events}
          currentWeekStart={currentWeekStart}
          onSave={handleSaveSlot}
          onDelete={handleDeleteSlot}
        />
      </div>
    </div>
  );
};

export default StudyPlanner;
