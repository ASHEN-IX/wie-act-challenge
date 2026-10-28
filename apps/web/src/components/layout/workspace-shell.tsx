import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { Navigation } from "./navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logout } from "@/features/auth/actions";
export function WorkspaceShell({
  email,
  admin,
  instructor = true,
  children,
}: {
  email: string;
  admin: boolean;
  instructor?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-background p-5 lg:flex">
        <Link
          href="/dashboard"
          className="mb-10 flex items-center gap-3 px-2 text-2xl font-semibold tracking-tight"
        >
          <BookOpen className="size-7 text-primary" />
          EdNova
        </Link>
        <Navigation admin={admin} instructor={instructor} />
        <div className="mt-auto flex flex-col gap-4 border-t pt-5">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{email.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium">Your workspace</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <header className="flex min-h-17 items-center justify-between gap-4 border-b px-5 lg:px-8">
        <div className="hidden text-sm text-muted-foreground lg:block">
          Workspace <span className="mx-3 text-border">/</span> EdNova
        </div>
        <details className="relative lg:hidden">
          <summary className="cursor-pointer text-lg font-semibold">
            EdNova{" "}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              Menu
            </span>
          </summary>
          <div className="absolute left-0 top-10 z-30 w-64 rounded-lg border bg-background p-4 shadow-lg">
            <Navigation admin={admin} instructor={instructor} />
            <form action={logout} className="mt-4">
              <Button variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </details>
        <form action="/courses" className="relative w-48 sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="q"
            aria-label="Search courses"
            placeholder="Search your courses…"
            className="pl-9"
          />
        </form>
      </header>
      <main
        id="main-content"
        className="mx-auto max-w-[1500px] px-5 py-9 sm:px-8 lg:py-10"
      >
        {children}
      </main>
    </div>
  );
}
