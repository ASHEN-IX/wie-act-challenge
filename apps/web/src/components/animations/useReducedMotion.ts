"use client";

import { useEffect, useState } from "react";

/**
 * Hook to detect if user has requested reduced motion.
 * Safely defaults to false during SSR and updates synchronously on client mount.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(onChange);
      return () => mediaQuery.removeListener(onChange);
    }
  }, []);

  return reducedMotion;
}
