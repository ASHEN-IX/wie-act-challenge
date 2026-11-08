/**
 * Bridge to the optional "EdNova Deep Focus" browser extension
 * (apps/extension/deep-focus). A web page cannot block other sites by itself;
 * the extension can. The page only reports whether Deep Focus is active and
 * listens for the extension's replies. Without the extension every call is a
 * harmless no-op.
 *
 * The extension's content script only runs on EdNova origins, trusts nothing
 * but same-window messages, and takes the allowed host from the tab itself,
 * never from this payload.
 */
const PAGE = "ednova-focus-page";
const GUARD = "ednova-focus-guard";

export type GuardMessage = { type: "ready" } | { type: "exit" };

export function reportFocus(active: boolean): void {
  if (typeof window === "undefined") return;
  window.postMessage({ source: PAGE, active }, window.location.origin);
}

export function listenGuard(onMessage: (message: GuardMessage) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data as { source?: unknown; type?: unknown } | null;
    if (!data || data.source !== GUARD) return;
    if (data.type === "ready" || data.type === "exit") onMessage({ type: data.type });
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
