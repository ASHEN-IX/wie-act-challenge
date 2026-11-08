import { Search } from "lucide-react";
import { Navigation } from "./navigation";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/features/auth/actions";
import { ThemeControl } from "@/features/courses/theme-control";

export function WorkspaceShell({
  email,
  admin,
  instructor = false,
  children,
}: {
  email: string;
  admin: boolean;
  instructor?: boolean;
  children: React.ReactNode;
}) {
  const roleLabel = admin
    ? "Administrator"
    : instructor
      ? "Instructor"
      : "Learner";

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-5 lg:flex">
        <div className="mb-6 flex items-center justify-between px-2">
          <Logo href="/dashboard" />
          <Badge
            variant="outline"
            className="border-brand-violet/40 text-[11px] font-medium text-brand-violet-soft"
          >
            {roleLabel}
          </Badge>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <Navigation admin={admin} instructor={instructor} />
        </div>
        <div className="mt-auto flex flex-col gap-3 border-t border-sidebar-border pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 border border-brand-violet/30">
              <AvatarFallback className="bg-brand-violet/20 text-xs font-semibold text-brand-violet-soft">
                {email.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {email.split("@")[0]}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {email}
              </p>
            </div>
          </div>
          <form action={logout}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 overflow-x-clip border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-5 lg:px-8">
        <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
          <span className="font-medium text-foreground">Noveris Workspace</span>
          <span className="text-border">/</span>
          <span className="capitalize">{roleLabel}</span>
        </div>
        <details className="relative lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 text-base font-semibold">
            <LogoMark size={30} />
            Noveris
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              Menu
            </span>
          </summary>
          <div className="absolute left-0 top-10 z-30 w-64 rounded-xl border border-border bg-card p-4 shadow-xl">
            <Navigation admin={admin} instructor={instructor} />
            <form action={logout} className="mt-4 border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                type="submit"
                className="w-full"
              >
                Sign out
              </Button>
            </form>
          </div>
        </details>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ThemeControl />
          <form
            action="/courses"
            className="relative hidden min-w-0 w-72 sm:block"
          >
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              name="q"
              aria-label="Search courses"
              placeholder="Search courses…"
              className="h-9 pl-9 text-xs sm:text-sm"
            />
          </form>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-8 lg:py-10"
      >
        {children}
      </main>
    </div>
  );
}
