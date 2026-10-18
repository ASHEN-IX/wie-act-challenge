import React, { useEffect, useMemo, useState, useCallback } from "react";
import "../WeeklyCalendar.css";
import {
  DAYS,
  START_HOUR,
  SLOT_MINUTES,
  TOTAL_SLOTS,
  SLOTS_PER_HOUR,
  clamp,
  slotIndexToClock,
  timeToSlotIndex,
  timeToEndSlotIndex,
  formatClock,
} from "./calendarUtils";
import CalendarGrid from "./CalendarGrid";
import SlotModal from "./SlotModal";
import DayPanel from "./DayPanel";

const EMPTY_SLOTS: any[] = [];
const slotIndexes = Array.from({ length: TOTAL_SLOTS }, (_: any, i: any) => i);

export default function WeeklyCalendar({
  availability = EMPTY_SLOTS,
  events = EMPTY_SLOTS,
  currentWeekStart,
  onSave,
  onDelete,
}: any) {
  const [selectedSlots, setSelectedSlots] = useState<any[]>([]);
  const [eventSlots, setEventSlots] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [label, setLabel] = useState("");
  const [isRecurring, setIsRecurring] = useState(true);
  const [rowHeight, setRowHeight] = useState(22);
  const [selectedDayIndex, setSelectedDayIndex] = useState<any>(null);
  const [dragSelection, setDragSelection] = useState<any>(null);
  const [zoomDrag, setZoomDrag] = useState<any>(null);
  const [createRange, setCreateRange] = useState({
    startIndex: 0,
    endIndex: 1,
  });
  const [selectedTimezone] = useState(() => {
    try {
      return (
        localStorage.getItem("calendar.timezone") ||
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );
    } catch {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  });

  useEffect(() => {
    const mappedAvailability = availability.map((av: any) => {
      const startIndex = timeToSlotIndex(av.start_time);
      const endIndex = Math.max(
        startIndex + 1,
        timeToEndSlotIndex(av.end_time),
      );
      return {
        id: av._id,
        day: av.day_of_week,
        startIndex,
        endIndex,
        label: av.label || "Blocked",
        backgroundColor: av.color || "var(--accent-color-dynamic)",
      };
    });
    setSelectedSlots(mappedAvailability);

    const mappedEvents = (events || []).map((ev: any) => {
      const start = new Date(ev.startTime);
      const end = new Date(ev.endTime);
      const dayOfWeek = start.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const weekStartDate = new Date(currentWeekStart);
      weekStartDate.setHours(0, 0, 0, 0);

      const eventDate = new Date(start);
      eventDate.setHours(0, 0, 0, 0);

      const week = Math.max(
        0,
        Math.floor(((eventDate as any) - (weekStartDate as any)) / (7 * 24 * 60 * 60 * 1000)),
      );

      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const startIndex = clamp(
        Math.floor((startMinutes - START_HOUR * 60) / SLOT_MINUTES),
        0,
        TOTAL_SLOTS - 1,
      );
      const endIndex = clamp(
        Math.ceil((endMinutes - START_HOUR * 60) / SLOT_MINUTES),
        startIndex + 1,
        TOTAL_SLOTS,
      );

      return {
        id: ev.taskId || ev.id || `${ev.title}-${start.toISOString()}`,
        week,
        dayIndex,
        startIndex,
        endIndex,
        label: ev.title,
        backgroundColor: ev.color || "var(--accent-color-dynamic)",
        isEvent: true,
        meta: ev,
      };
    });

    setEventSlots(mappedEvents);
  }, [availability, events, currentWeekStart]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragSelection) {
        openCreateModalFromSelection(dragSelection);
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [dragSelection]);

  useEffect(() => {
    if (!zoomDrag) return;

    const handleMouseMove = (event: any) => {
      const delta = zoomDrag.startY - event.clientY;
      const computed = clamp(
        zoomDrag.startHeight + Math.round(delta / 3),
        14,
        38,
      );
      setRowHeight(computed);
    };

    const handleMouseUp = () => {
      setZoomDrag(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [zoomDrag]);

  const openCreateModalFromSelection = (selection: any) => {
    const startIndex = Math.min(selection.startIndex, selection.endIndex);
    const endIndexInclusive = Math.max(
      selection.startIndex,
      selection.endIndex,
    );
    const endIndexExclusive = clamp(
      endIndexInclusive + 1,
      startIndex + 1,
      TOTAL_SLOTS,
    );

    setCreateRange({ startIndex, endIndex: endIndexExclusive });
    setModalData({
      type: "create",
      week: selection.week,
      dayIndex: selection.dayIndex,
    });
    setShowModal(true);
    setDragSelection(null);
  };

  const handleCellMouseDown = useCallback(
    (week: any, dayIndex: any, slotIndex: any) => {
      const eventSlot = eventSlots.find(
        (s) =>
          s.week === week &&
          s.dayIndex === dayIndex &&
          slotIndex >= s.startIndex &&
          slotIndex < s.endIndex,
      );
      if (eventSlot) {
        setModalData({ type: "event", slot: eventSlot });
        setShowModal(true);
        return;
      }

      const blockedSlot = selectedSlots.find(
        (s) =>
          s.day === DAYS[dayIndex] &&
          slotIndex >= s.startIndex &&
          slotIndex < s.endIndex,
      );
      if (blockedSlot) {
        setCreateRange({
          startIndex: blockedSlot.startIndex,
          endIndex: blockedSlot.endIndex,
        });
        setLabel(blockedSlot.label || "");
        setIsRecurring(true);
        setModalData({ type: "edit", slot: blockedSlot, week, dayIndex });
        setShowModal(true);
        return;
      }

      setDragSelection({
        week,
        dayIndex,
        startIndex: slotIndex,
        endIndex: slotIndex,
      });
    },
    [eventSlots, selectedSlots],
  );

  const handleCellMouseEnter = useCallback(
    (week: any, dayIndex: any, slotIndex: any) => {
      if (!dragSelection) return;
      if (dragSelection.week !== week || dragSelection.dayIndex !== dayIndex)
        return;

      setDragSelection((prev: any) =>
        prev
          ? {
              ...prev,
              endIndex: slotIndex,
            }
          : prev,
      );
    },
    [dragSelection],
  );

  const handleCellMouseUp = useCallback(() => {
    if (dragSelection) {
      openCreateModalFromSelection(dragSelection);
    }
  }, [dragSelection]);

  const handleCreateSlot = () => {
    if (!label.trim()) {
      alert("Please enter a label for this time slot");
      return;
    }

    const { dayIndex } = modalData;
    const startClock = slotIndexToClock(createRange.startIndex);
    const endClock = slotIndexToClock(createRange.endIndex);

    const payload = {
      day_of_week: DAYS[dayIndex],
      start_time: startClock,
      end_time: endClock,
      label: label.trim(),
      is_recurring: isRecurring,
      color: "var(--accent-color-dynamic)",
    };

    if (onSave) {
      onSave(payload);
    }

    closeModal();
  };

  const handleDeleteSlot = () => {
    const { slot } = modalData;
    if (onDelete && slot.id) {
      onDelete(slot.id);
    }
    closeModal();
  };

  const handleUpdateSlot = () => {
    if (!label.trim()) {
      alert("Please enter a label for this time slot");
      return;
    }

    const { slot, dayIndex } = modalData;
    if (onDelete && slot.id) {
      onDelete(slot.id);
    }

    const payload = {
      day_of_week: DAYS[dayIndex],
      start_time: slotIndexToClock(createRange.startIndex),
      end_time: slotIndexToClock(createRange.endIndex),
      label: label.trim(),
      is_recurring: isRecurring,
      color: "var(--accent-color-dynamic)",
    };

    if (onSave) {
      onSave(payload);
    }

    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setModalData(null);
    setLabel("");
    setIsRecurring(true);
    setDragSelection(null);
  };

  const selectedDayDetail = useMemo(() => {
    if (selectedDayIndex === null) return null;

    const blockedItems = selectedSlots
      .filter((slot) => slot.day === DAYS[selectedDayIndex])
      .sort((a: any, b: any) => a.startIndex - b.startIndex)
      .map((slot) => ({
        id: slot.id,
        label: slot.label,
        kind: "Blocked",
        timeRange: `${formatClock(slotIndexToClock(slot.startIndex))} - ${formatClock(slotIndexToClock(slot.endIndex))}`,
        color: slot.backgroundColor,
      }));

    const eventItems = eventSlots
      .filter((slot) => slot.dayIndex === selectedDayIndex)
      .sort((a: any, b: any) => a.startIndex - b.startIndex)
      .map((slot) => ({
        id: slot.id,
        label: slot.label,
        kind: "Study session",
        timeRange: `${formatClock(slotIndexToClock(slot.startIndex))} - ${formatClock(slotIndexToClock(slot.endIndex))}`,
        color: slot.backgroundColor,
      }));

    return [...eventItems, ...blockedItems].sort((a: any, b: any) =>
      a.timeRange.localeCompare(b.timeRange),
    );
  }, [selectedDayIndex, selectedSlots, eventSlots]);

  const slotDurationMinutes =
    (createRange.endIndex - createRange.startIndex) * SLOT_MINUTES;

  return (
    <div className="weekly-calendar">
      <div className="calendar-header">
        <div className="calendar-zoom-controls">
          <span className="zoom-label">Scale</span>
          <button
            type="button"
            className={`zoom-drag-handle ${zoomDrag ? "active" : ""}`}
            onMouseDown={(event: any) => {
              setZoomDrag({ startY: event.clientY, startHeight: rowHeight });
            }}
          >
            Hold and drag to resize ({rowHeight}px)
          </button>
          <span className="timezone-chip">{selectedTimezone}</span>
          {selectedDayIndex !== null && (
            <button
              className="focus-reset-btn"
              onClick={() => setSelectedDayIndex(null)}
            >
              Back to Week
            </button>
          )}
        </div>
      </div>

      <div className="calendar-layout">
        <CalendarGrid
          currentWeekStart={currentWeekStart}
          weekIndex={0}
          selectedDayIndex={selectedDayIndex}
          rowHeight={rowHeight}
          slotIndexes={slotIndexes}
          eventSlots={eventSlots}
          selectedSlots={selectedSlots}
          dragSelection={dragSelection}
          onCellMouseDown={handleCellMouseDown}
          onCellMouseEnter={handleCellMouseEnter}
          onCellMouseUp={handleCellMouseUp}
          onSelectDay={setSelectedDayIndex}
        />

        <DayPanel
          selectedDayIndex={selectedDayIndex}
          selectedDayDetail={selectedDayDetail}
        />
      </div>

      <SlotModal
        showModal={showModal}
        modalData={modalData}
        label={label}
        isRecurring={isRecurring}
        createRange={createRange}
        slotIndexes={slotIndexes}
        slotDurationMinutes={slotDurationMinutes}
        onLabelChange={setLabel}
        onRecurringChange={setIsRecurring}
        onCreateRangeChange={setCreateRange}
        onClose={closeModal}
        onCreate={handleCreateSlot}
        onUpdate={handleUpdateSlot}
        onDelete={handleDeleteSlot}
      />
    </div>
  );
}
