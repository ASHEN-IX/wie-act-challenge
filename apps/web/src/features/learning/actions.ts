"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { api, segment } from "@/lib/api";
import { text } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function searchSources(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const result = await api<{ jobId: string }>("/api/v1/search/query", {
      method: "POST",
      body: JSON.stringify({ query: text(form, "query", 500), maxResults: 5 }),
    });
    return { jobId: result.jobId, success: "Searching for sources…" };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to search.",
    };
  }
}

export async function readJob(kind: "eval" | "search" | "ai", id: string) {
  const prefixes = {
    eval: "/api/v1/eval/jobs/",
    search: "/api/v1/search/jobs/",
    ai: "/api/v1/ai/jobs/",
  };
  if (!Object.hasOwn(prefixes, kind)) throw new Error("Invalid job kind");
  return api<{
    status: string;
    result?: unknown;
    error?: unknown;
    fallbackUsed?: boolean;
  }>(prefixes[kind] + segment(id));
}
