import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-8"
    >
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        This page may have moved. Your workspace is a good place to start.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to workspace</Link>
      </Button>
    </main>
  );
}
