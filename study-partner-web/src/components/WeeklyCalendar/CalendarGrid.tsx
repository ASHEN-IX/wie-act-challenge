import React from "react";
import {
  DAYS,
  SLOTS_PER_HOUR,
  TOTAL_SLOTS,
  formatClock,
  slotIndexToClock,
} from "./calendarUtils";

export default function CalendarGrid({
  currentWeekStart,
  weekIndex = 0,
  selectedDayIndex,
  rowHeight,
  slotIndexes,
  eventSlots,
  selectedSlots,
  dragSelection,
  onCellMouseDown,
  onCellMouseEnter,
  onCellMouseUp,
  onSelectDay,
}: any) {
  const findEventAt = (week: any, dayIndex: any, slotIndex: any) =>
    eventSlots.find(
      (slot: any) =>
        slot.week === week &&
        slot.dayIndex === dayIndex &&
        slotIndex >= slot.startIndex &&
        slotIndex < slot.endIndex,
    );

  const findBlockedAt = (dayIndex: any, slotIndex: any) =>
    selectedSlots.find(
      (slot: any) =>
        slot.day === DAYS[dayIndex] &&
        slotIndex >= slot.startIndex &&
        slotIndex < slot.endIndex,
    );

  const isCellSelectedByDrag = (week: any, dayIndex: any, slotIndex: any) => {
    if (!dragSelection) return false;
    if (dragSelection.week !== week || dragSelection.dayIndex !== dayIndex)
      return false;
    const minIndex = Math.min(dragSelection.startIndex, dragSelection.endIndex);
    const maxIndex = Math.max(dragSelection.startIndex, dragSelection.endIndex);
    return slotIndex >= minIndex && slotIndex <= maxIndex;
  };

  const getCellStyle = (week: any, dayIndex: any, slotIndex: any) => {
    const eventSlot = findEventAt(week, dayIndex, slotIndex);
    if (eventSlot) {
      return { backgroundColor: eventSlot.backgroundColor, color: "white" };
    }
    const blockedSlot = findBlockedAt(dayIndex, slotIndex);
    if (blockedSlot) {
      return { backgroundColor: blockedSlot.backgroundColor, color: "white" };
    }
    if (isCellSelectedByDrag(week, dayIndex, slotIndex)) {
      return { backgroundColor: "rgba(147, 51, 234, 0.35)", color: "white" };
    }
    return {};
  };

  const weekStart = new Date(currentWeekStart);
  weekStart.setDate(weekStart.getDate() + weekIndex * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="calendar-main">
      <div key={weekIndex} className="week-section">
        <div className="week-header">
          Week {weekIndex + 1}: {weekLabel}
        </div>

        <div className="calendar-grid">
          <div className="time-column">
            <div className="corner-cell">Time</div>
            {slotIndexes.map((slotIndex: any) => {
              const isHourStart = slotIndex % SLOTS_PER_HOUR === 0;
              const label = isHourStart
                ? formatClock(slotIndexToClock(slotIndex))
                : "";
              return (
                <div
                  key={`time-${slotIndex}`}
                  className={`time-cell ${isHourStart ? "hour-start" : ""}`}
                  style={{ height: `${rowHeight}px` }}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {DAYS.map((day: any, dayIndex: any) => {
            if (selectedDayIndex !== null && selectedDayIndex !== dayIndex) {
              return null;
            }

            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + weekIndex * 7 + dayIndex);
            const dateStr = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div key={`${weekIndex}-${day}`} className="day-column">
                <div
                  className={`day-header ${isToday ? "today" : ""} ${selectedDayIndex === dayIndex ? "focused" : ""}`}
                  onClick={() => onSelectDay(dayIndex)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectDay(dayIndex);
                    }
                  }}
                >
                  {day}
                  <br />
                  {dateStr}
                </div>

                <div
                  className="day-grid-container"
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    flex: 1,
                  }}
                >
                  {slotIndexes.map((slotIndex: any) => (
                    <div
                      key={`${weekIndex}-${dayIndex}-${slotIndex}`}
                      className={`time-slot`}
                      style={{
                        ...getCellStyle(weekIndex, dayIndex, slotIndex),
                        height: `${rowHeight}px`,
                        backgroundColor: isCellSelectedByDrag(
                          weekIndex,
                          dayIndex,
                          slotIndex,
                        )
                          ? "rgba(147, 51, 234, 0.15)"
                          : "transparent",
                        borderColor: "transparent",
                        borderBottom: "1px solid var(--border)",
                      }}
                      onMouseDown={() =>
                        onCellMouseDown(weekIndex, dayIndex, slotIndex)
                      }
                      onMouseEnter={() =>
                        onCellMouseEnter(weekIndex, dayIndex, slotIndex)
                      }
                      onMouseUp={onCellMouseUp}
                    />
                  ))}

                  {eventSlots
                    .filter(
                      (s: any) =>
                        s.week === weekIndex && s.dayIndex === dayIndex,
                    )
                    .map((slot: any) => (
                      <div
                        key={`event-${slot.id}`}
                        className="absolute-event study-session-card"
                        style={{
                          position: "absolute",
                          top: `${slot.startIndex * (rowHeight + 2)}px`,
                          height: `${(slot.endIndex - slot.startIndex) * (rowHeight + 2) - 2}px`,
                          left: "2px",
                          right: "2px",
                          backgroundColor:
                            slot.backgroundColor || "var(--primary)",
                          borderRadius: "8px",
                          color: "white",
                          padding: "6px 8px",
                          fontSize: "0.8rem",
                          fontWeight: "600",
                          overflow: "hidden",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                          zIndex: 10,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                        onMouseDown={(e: any) => {
                          e.stopPropagation();
                          onCellMouseDown(weekIndex, dayIndex, slot.startIndex);
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {slot.label}
                        </span>
                        {slot.endIndex - slot.startIndex >= 4 && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              opacity: 0.8,
                              marginTop: "auto",
                            }}
                          >
                            {formatClock(slotIndexToClock(slot.startIndex))} -{" "}
                            {formatClock(slotIndexToClock(slot.endIndex))}
                          </span>
                        )}
                      </div>
                    ))}

                  {selectedSlots
                    .filter((s: any) => s.day === DAYS[dayIndex])
                    .map((slot: any, i: any) => (
                      <div
                        key={`blocked-${slot.id || i}`}
                        className="absolute-event blocked-session-card"
                        style={{
                          position: "absolute",
                          top: `${slot.startIndex * (rowHeight + 2)}px`,
                          height: `${(slot.endIndex - slot.startIndex) * (rowHeight + 2) - 2}px`,
                          left: "2px",
                          right: "2px",
                          backgroundColor:
                            slot.backgroundColor ||
                            "rgba(100, 116, 139, 0.9)",
                          borderRadius: "8px",
                          color: "white",
                          padding: "6px 8px",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                          overflow: "hidden",
                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
                          zIndex: 5,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px dashed rgba(255,255,255,0.4)",
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)",
                        }}
                        onMouseDown={(e: any) => {
                          e.stopPropagation();
                          onCellMouseDown(weekIndex, dayIndex, slot.startIndex);
                        }}
                      >
                        <span
                          style={{
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {slot.label}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
