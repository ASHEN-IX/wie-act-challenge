import React from "react";

function ProgressBar({
  value = 0,
  max = 100,
  label = "",
  showPercentage = true,
  size = "md",
  color = "primary",
  className = "",
}: any) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  const sizes = {
    sm: "h-1.5",
    md: "h-3",
    lg: "h-5",
  };

  const colors = {
    primary: "from-primary to-primary/80",
    green:
      "from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]",
    blue: "from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]",
    yellow:
      "from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]",
    red: "from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]",
    purple:
      "from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]",
  };

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className="text-xs text-muted-foreground font-medium">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-xs text-muted-foreground font-bold">
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-muted/50 rounded-full overflow-hidden ${(sizes as any)[size]}`}
      >
        <div
          className={`h-full bg-gradient-to-r ${(colors as any)[color]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
