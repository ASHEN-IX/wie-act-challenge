import React, { useRef, useEffect } from "react";
import {
  DAYS,
  TOTAL_SLOTS,
  SLOTS_PER_HOUR,
  formatClock,
  slotIndexToClock,
} from "./calendarUtils";

export default function SlotModal({
  showModal,
  modalData,
  label,
  isRecurring,
  createRange,
  slotIndexes,
  slotDurationMinutes,
  onLabelChange,
  onRecurringChange,
  onCreateRangeChange,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: any) {
  const modalRef = useRef<any>(null);

  useEffect(() => {
    if (!showModal || !modalRef.current) return;
    const el = modalRef.current;
    const prev = document.activeElement;
    el.focus();
    const handleKey = (e: any) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = el.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el.addEventListener("keydown", handleKey);
    return () => {
      el.removeEventListener("keydown", handleKey);
      if (prev) (prev as HTMLElement).focus();
    };
  }, [showModal, onClose]);

  if (!showModal || !modalData) return null;

  const handleStartChange = (e: any) => {
    const nextStart = Number(e.target.value);
    onCreateRangeChange((prev: any) => ({
      startIndex: nextStart,
      endIndex: Math.max(nextStart + 1, prev.endIndex),
    }));
  };

  const handleEndChange = (e: any) => {
    const nextEnd = Number(e.target.value);
    onCreateRangeChange((prev: any) => ({
      startIndex: Math.min(prev.startIndex, nextEnd - 1),
      endIndex: Math.max(prev.startIndex + 1, nextEnd),
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
        className="modal-content"
        tabIndex={-1}
        onClick={(e: any) => e.stopPropagation()}
      >
        {modalData.type === "create" ? (
          <>
            <h3 id="calendar-modal-title">Block This Time</h3>
            <div className="form-group">
              <label>Label:</label>
              <input
                type="text"
                placeholder="e.g., Math Class, Work, Gym"
                value={label}
                onChange={(e: any) => onLabelChange(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e: any) => onRecurringChange(e.target.checked)}
                />
                Repeat every week
              </label>
            </div>
            <div className="form-group">
              <label>Start</label>
              <select value={createRange.startIndex} onChange={handleStartChange}>
                {slotIndexes.map((slotIndex: any) => (
                  <option key={`start-${slotIndex}`} value={slotIndex}>
                    {formatClock(slotIndexToClock(slotIndex))}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>End</label>
              <select value={createRange.endIndex} onChange={handleEndChange}>
                {slotIndexes
                  .filter((slotIndex: any) => slotIndex > createRange.startIndex)
                  .map((slotIndex: any) => (
                    <option key={`end-${slotIndex}`} value={slotIndex}>
                      {formatClock(slotIndexToClock(slotIndex))}
                    </option>
                  ))}
                <option value={TOTAL_SLOTS}>
                  {formatClock(slotIndexToClock(TOTAL_SLOTS))}
                </option>
              </select>
            </div>
            <div className="form-group">
              <label>Duration</label>
              <p className="text-sm text-muted-foreground">
                {slotDurationMinutes} minutes (
                {(slotDurationMinutes / 60).toFixed(1)} hours)
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-save" onClick={onCreate}>
                Block Time
              </button>
            </div>
          </>
        ) : modalData.type === "edit" ? (
          <>
            <h3 id="calendar-modal-title">Edit Time Block</h3>
            <div className="form-group">
              <label>Label:</label>
              <input
                type="text"
                placeholder="e.g., Math Class, Work, Gym"
                value={label}
                onChange={(e: any) => onLabelChange(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e: any) => onRecurringChange(e.target.checked)}
                />
                Repeat every week
              </label>
            </div>
            <div className="form-group">
              <label>Start</label>
              <select value={createRange.startIndex} onChange={handleStartChange}>
                {slotIndexes.map((slotIndex: any) => (
                  <option key={`edit-start-${slotIndex}`} value={slotIndex}>
                    {formatClock(slotIndexToClock(slotIndex))}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>End</label>
              <select value={createRange.endIndex} onChange={handleEndChange}>
                {slotIndexes
                  .filter((slotIndex: any) => slotIndex > createRange.startIndex)
                  .map((slotIndex: any) => (
                    <option key={`edit-end-${slotIndex}`} value={slotIndex}>
                      {formatClock(slotIndexToClock(slotIndex))}
                    </option>
                  ))}
                <option value={TOTAL_SLOTS}>
                  {formatClock(slotIndexToClock(TOTAL_SLOTS))}
                </option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-delete" onClick={onDelete}>
                Delete
              </button>
              <button className="btn-save" onClick={onUpdate}>
                Save Changes
              </button>
            </div>
          </>
        ) : modalData.type === "delete" ? (
          <>
            <h3>Delete Time Block</h3>
            <p>
              Remove <strong>{modalData.slot.label}</strong> on{" "}
              <strong>{modalData.slot.day}</strong>?
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button className="btn-delete" onClick={onDelete}>
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>Scheduled Session</h3>
            <p>
              <strong>{modalData.slot.label}</strong>
            </p>
            <p className="muted">
              {new Date(modalData.slot.meta.startTime).toLocaleString()} —{" "}
              {new Date(modalData.slot.meta.endTime).toLocaleTimeString()}
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
