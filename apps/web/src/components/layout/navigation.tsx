"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  PencilLine,
  Users,
  ListTodo,
  ChartNoAxesCombined,
  CalendarDays,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
const links = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/courses", "Courses", BookOpen],
  ["/institutions", "Institutions", Users],
  ["/practice", "Practice", PencilLine],
  ["/visualizer", "Worked example", PencilLine],
  ["/study-together", "Study together", Users],
  ["/tasks", "Tasks", ListTodo],
  ["/progress", "Progress", ChartNoAxesCombined],
  ["/instructor-insights", "Instructor insights", ChartNoAxesCombined],
  ["/planner", "Study planner", CalendarDays],
  ["/search", "Explore sources", Search],
] as const;
export function Navigation({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
      {links.map(([href, label, Icon]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
            pathname.startsWith(href)
              ? "bg-accent text-primary"
              : "text-muted-foreground",
          )}
        >
          <Icon className="size-[18px]" />
          {label}
        </Link>
      ))}
      {admin && (
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm"
        >
          <ShieldCheck className="size-[18px]" />
          Administration
        </Link>
      )}
      <Link
        href="/profile"
        className="mt-6 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent"
      >
        <Settings className="size-[18px]" />
        Settings
      </Link>
    </nav>
  );
}
