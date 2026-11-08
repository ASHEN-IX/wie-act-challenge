"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  ListTodo,
  ChartNoAxesCombined,
  CalendarDays,
  Search,
  Settings,
  ShieldCheck,
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
  instructor = false,
}: {
  admin?: boolean;
  instructor?: boolean;
}) {
  const pathname = usePathname();

  // Learn something, study with others, track what you've learned. Practice
  // and the tutor live inside each course (My Learning), and the course page
  // links to the visual experiments for its own material. "More tools" keeps
  // only standalone helpers; /practice and /visualizer remain valid URLs.
  const teaching = instructor || admin;
  const sections: NavSection[] = [
    {
      items: [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        {
          href: "/courses",
          label: teaching ? "My courses" : "My Learning",
          icon: BookOpen,
        },
        ...(!teaching ? [{ href: "/study-together", label: "Study Together", icon: Users }] : []),
        ...(!teaching
          ? [
              {
                href: "/progress",
                label: "Progress",
                icon: ChartNoAxesCombined,
              },
            ]
          : []),
      ],
    },
  ];

  const moreItems: NavItem[] = teaching
    ? []
    : [
        { href: "/visual-lab", label: "Visual Lab", icon: FlaskConical },
        { href: "/tasks", label: "Tasks", icon: ListTodo },
        { href: "/planner", label: "Study plan", icon: CalendarDays },
        { href: "/search", label: "Explore sources", icon: Search },
      ];

  if (instructor || admin) {
    sections.push({
      title: "Teaching Studio",
      items: [
        { href: "/courses/new", label: "Course Studio", icon: GraduationCap },
        {
          href: "/instructor-insights",
          label: "Instructor insights",
          icon: ChartNoAxesCombined,
        },
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
    if (href === "/courses")
      return (
        pathname.startsWith("/courses") && !pathname.startsWith("/courses/new")
      );
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
            ? "bg-brand-violet/16 font-semibold text-brand-violet-soft shadow-xs"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          <Icon
            className={cn(
              "size-[18px] shrink-0 transition-transform group-hover:scale-105",
              isActive ? "text-brand-violet-soft" : "text-muted-foreground",
            )}
          />
          <span className="truncate">{label}</span>
        </div>
        {badge && (
          <span className="rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-semibold text-brand-cyan">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Workspace navigation"
      className="flex flex-col gap-5 text-sm"
    >
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
      {moreItems.length > 0 && (
        <details
          className="group/more flex flex-col gap-1"
          open={moreItems.some((item) => isActiveHref(item.href))}
        >
          <summary className="cursor-pointer list-none rounded-lg px-3 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            More tools
          </summary>
          <div className="mt-1 flex flex-col gap-1">
            {moreItems.map(renderItem)}
          </div>
        </details>
      )}
      <div className="mt-1 border-t border-sidebar-border pt-3">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
            pathname.startsWith("/profile")
              ? "bg-brand-violet/16 font-semibold text-brand-violet-soft"
              : "text-muted-foreground",
          )}
        >
          <Settings className="size-[18px] text-muted-foreground" />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  );
}
