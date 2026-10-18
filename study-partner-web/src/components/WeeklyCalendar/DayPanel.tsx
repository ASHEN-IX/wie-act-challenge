import React from "react";
import { DAYS } from "./calendarUtils";

export default function DayPanel({ selectedDayIndex, selectedDayDetail }: any) {
  if (selectedDayIndex === null) return null;

  return (
    <aside className="day-detail-panel">
      <h3>{DAYS[selectedDayIndex]}</h3>
      <p className="panel-subtitle">Focused day timeline</p>
      {selectedDayDetail && selectedDayDetail.length > 0 ? (
        <div className="day-detail-list">
          {selectedDayDetail.map((item: any) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="day-detail-item"
            >
              <span
                className="day-detail-dot"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <p className="day-detail-label">{item.label}</p>
                <p className="day-detail-meta">
                  {item.kind} - {item.timeRange}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="panel-empty">
          No sessions or blocked ranges for this day.
        </p>
      )}
    </aside>
  );
}
