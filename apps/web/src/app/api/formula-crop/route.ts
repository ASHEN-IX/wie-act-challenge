import { requireIdentity } from "@/server/identity";
import { segment } from "@/lib/api";
import { headers } from "next/headers";
export async function GET(request: Request) {
  await requireIdentity();
  try {
    const q = new URL(request.url).searchParams;
    const [course, revision, document, region] = [
      "course",
      "revision",
      "document",
      "region",
    ].map((k) => segment(q.get(k) || ""));
    const response = await fetch(
      new URL(
        `/api/v1/study/courses/${course}/drafts/${revision}/sources/${document}/regions/${region}`,
        process.env.BACKEND_URL || "http://localhost:3001",
      ),
      {
        headers: { cookie: (await headers()).get("cookie") || "" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok || response.headers.get("content-type") !== "image/png")
      return new Response("Source crop unavailable", {
        status: response.ok ? 503 : response.status,
      });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 8_000_000)
      return new Response("Source crop too large", { status: 422 });
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return new Response("Source crop unavailable", { status: 503 });
  }
}
