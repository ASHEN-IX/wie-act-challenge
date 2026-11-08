"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPendingInvitationCount } from "@/features/courses/actions";

export function NotificationsLink() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const next = await getPendingInvitationCount();
        if (active && next !== null) setCount(next);
      } catch {
        // Leave the last known count visible during temporary outages.
      } finally {
        pending = false;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 45_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  return (
    <Button asChild variant="ghost" size="icon" className="relative shrink-0">
      <Link href="/notifications" aria-label={count ? `Notifications, ${count} pending course invitations` : "Notifications"}>
        <Bell aria-hidden />
        {count > 0 && (
          <span aria-hidden className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
