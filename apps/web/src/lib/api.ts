import "server-only";
import { headers } from "next/headers";
import { requireIdentity } from "@/server/identity";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Server-only authenticated gateway. Resource authorization remains in Nest. */
export async function api<T>(
  endpoint: string,
  options: RequestInit = {},
  decode?: (value: unknown) => T,
): Promise<T> {
  await requireIdentity();
  if (!endpoint.startsWith("/api/v1/") || endpoint.includes(".."))
    throw new Error("Invalid API operation");
  const incoming = await headers();
  const outgoing = new Headers(options.headers);
  outgoing.set("cookie", incoming.get("cookie") || "");
  outgoing.set(
    "origin",
    process.env.BETTER_AUTH_URL || "http://localhost:5173",
  );
  if (options.body && !(options.body instanceof FormData))
    outgoing.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(
      new URL(endpoint, process.env.BACKEND_URL || "http://localhost:3000"),
      {
        ...options,
        headers: outgoing,
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch {
    throw new ApiError(503, "The service is unavailable. Please try again.");
  }
  const data: unknown =
    response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error.slice(0, 240)
        : "The request could not be completed.";
    throw new ApiError(response.status, message);
  }
  if (decode) {
    try {
      return decode(data);
    } catch {
      throw new ApiError(502, "The service returned an unsupported response.");
    }
  }
  return data as T;
}

export async function load<T>(
  endpoint: string,
): Promise<{ data?: T; error?: string }> {
  try {
    return { data: await api<T>(endpoint) };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: error.message };
  }
}

export function segment(value: string): string {
  if (!value || value.length > 150 || !/^[a-zA-Z0-9_-]+$/.test(value))
    throw new Error("Invalid identifier");
  return encodeURIComponent(value);
}
