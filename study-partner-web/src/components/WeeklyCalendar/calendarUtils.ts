export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const START_HOUR = 7;
export const END_HOUR = 22;
export const SLOT_MINUTES = 10;
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
export const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;

export const clamp = (value: any, min: any, max: any) => Math.max(min, Math.min(max, value));

export const toMinutesFromClock = (clockValue: any) => {
  const [hours, minutes] = String(clockValue || "00:00")
    .split(":")
    .map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const slotIndexToMinutes = (slotIndex: any) =>
  START_HOUR * 60 + slotIndex * SLOT_MINUTES;

export const slotIndexToClock = (slotIndex: any) => {
  const minutes = slotIndexToMinutes(slotIndex);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const formatClock = (clockValue: any) => {
  const [rawH, rawM] = String(clockValue || "00:00")
    .split(":")
    .map(Number);
  const h12 = rawH % 12 === 0 ? 12 : rawH % 12;
  const suffix = rawH >= 12 ? "PM" : "AM";
  return `${h12}:${String(rawM || 0).padStart(2, "0")} ${suffix}`;
};

export const timeToSlotIndex = (clockValue: any) => {
  const totalMinutes = toMinutesFromClock(clockValue);
  const relative = totalMinutes - START_HOUR * 60;
  return clamp(Math.floor(relative / SLOT_MINUTES), 0, TOTAL_SLOTS - 1);
};

export const timeToEndSlotIndex = (clockValue: any) => {
  const totalMinutes = toMinutesFromClock(clockValue);
  const relative = totalMinutes - START_HOUR * 60;
  return clamp(Math.ceil(relative / SLOT_MINUTES), 1, TOTAL_SLOTS);
};
