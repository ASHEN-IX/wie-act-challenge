import Link from "next/link";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { Navigation } from "./navigation";
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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card/60 backdrop-blur-md p-5 lg:flex">
        <div className="mb-6 flex items-center justify-between px-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            <img
              src="/ednova-mark.svg"
              alt=""
              width="36"
              height="36"
              className="size-9 rounded-xl shadow-sm"
            />
            <span>EdNova</span>
          </Link>
          <Badge variant="outline" className="text-[11px] font-medium">
            {roleLabel}
          </Badge>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <Navigation admin={admin} instructor={instructor} />
        </div>
        <div className="mt-auto flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 border">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
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
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 overflow-x-clip border-b bg-background/80 backdrop-blur-md px-4 sm:px-5 lg:px-8">
        <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
          <span className="font-medium text-foreground">EdNova Workspace</span>
          <span className="text-border">/</span>
          <span className="capitalize">{roleLabel}</span>
        </div>
        <details className="relative lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 text-base font-semibold">
            <BookOpen className="size-5 text-primary" />
            <img
              src="/ednova-mark.svg"
              alt=""
              width="30"
              height="30"
              className="rounded-lg"
            />
            EdNova
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              Menu
            </span>
          </summary>
          <div className="absolute left-0 top-10 z-30 w-64 rounded-xl border bg-card p-4 shadow-xl">
            <Navigation admin={admin} instructor={instructor} />
            <form action={logout} className="mt-4 border-t pt-3">
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
              placeholder="Search concepts or courses…"
              className="h-9 pl-9 text-xs sm:text-sm"
            />
          </form>
          {!instructor && !admin && (
            <Button
              asChild
              size="sm"
              variant="default"
              className="hidden sm:inline-flex gap-1.5 shadow-xs"
            >
              <Link href="/practice">
                <Sparkles className="size-3.5" />
                <span>Practice</span>
              </Link>
            </Button>
          )}
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
