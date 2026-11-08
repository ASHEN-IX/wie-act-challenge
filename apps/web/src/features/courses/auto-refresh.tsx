"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the server page while the course is processing, so the next step appears on its own. */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
