import React from "react";
import { Loader2 } from "lucide-react";

function LoadingSpinner({ size = "md", text = "", className = "" }: any) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <Loader2 className={`${(sizes as any)[size]} animate-spin text-primary`} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export default LoadingSpinner;
