import React from "react";

export default function VolumeControl({ value, onChange }: any) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-300">
      Volume
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event: any) => onChange(Number(event.target.value))}
        className="w-full"
      />
      <span>{value}%</span>
    </label>
  );
}
