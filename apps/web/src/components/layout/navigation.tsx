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
  Sparkles,
  GraduationCap,
  Building2,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export function Navigation({
  admin = false,
  instructor = true,
}: {
  admin?: boolean;
  instructor?: boolean;
}) {
  const pathname = usePathname();

  // Learn something, study with others, track what you've learned. Everything
  // else stays reachable under "More tools" so existing bookmarks keep working.
  const sections: NavSection[] = [
    {
      items: [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: "/courses", label: "My Learning", icon: BookOpen },
        { href: "/study-together", label: "Study Together", icon: Users, badge: "Live" },
        { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
      ],
    },
  ];

  const moreItems: NavItem[] = [
    { href: "/visual-lab", label: "Visual Lab", icon: FlaskConical },
    { href: "/practice", label: "Practice", icon: PencilLine },
    { href: "/visualizer", label: "Binary search demo", icon: Sparkles },
    { href: "/tasks", label: "Tasks", icon: ListTodo },
    { href: "/planner", label: "Study plan", icon: CalendarDays },
    { href: "/search", label: "Explore sources", icon: Search },
  ];

  if (instructor || admin) {
    sections.push({
      title: "Teaching Studio",
      items: [
        { href: "/courses/new", label: "Course Studio", icon: GraduationCap },
        { href: "/instructor-insights", label: "Instructor insights", icon: ChartNoAxesCombined },
      ],
    });
  }

  if (admin) {
    sections.push({
      title: "Institution",
      items: [
        { href: "/institutions", label: "Institutions", icon: Building2 },
        { href: "/admin", label: "Administration", icon: ShieldCheck },
      ],
    });
  }

  const isActiveHref = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    // Course Studio lives under /courses/new but is a teaching tool, not My Learning.
    if (href === "/courses") return pathname.startsWith("/courses") && !pathname.startsWith("/courses/new");
    return pathname.startsWith(href);
  };

  const renderItem = ({ href, label, icon: Icon, badge }: NavItem) => {
    const isActive = isActiveHref(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex items-center justify-between rounded-lg px-3 py-2 font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-ring",
          isActive
            ? "bg-accent/80 text-primary font-semibold shadow-xs"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          <Icon
            className={cn(
              "size-[18px] shrink-0 transition-transform group-hover:scale-105",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span className="truncate">{label}</span>
        </div>
        {badge && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav aria-label="Workspace navigation" className="flex flex-col gap-5 text-sm">
      {sections.map((section, sIdx) => (
        <div key={section.title || sIdx} className="flex flex-col gap-1">
          {section.title && (
            <span className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.title}
            </span>
          )}
          {section.items.map(renderItem)}
        </div>
      ))}
      <details
        className="group/more flex flex-col gap-1"
        open={moreItems.some((item) => isActiveHref(item.href))}
      >
        <summary className="cursor-pointer list-none rounded-lg px-3 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          More tools
        </summary>
        <div className="mt-1 flex flex-col gap-1">{moreItems.map(renderItem)}</div>
      </details>
      <div className="border-t pt-3 mt-1">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
            pathname.startsWith("/profile")
              ? "bg-accent/80 text-primary font-semibold"
              : "text-muted-foreground"
          )}
        >
          <Settings className="size-[18px] text-muted-foreground" />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  );
}
