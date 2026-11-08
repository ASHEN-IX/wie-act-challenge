// Runs only on EdNova origins (see manifest "matches"). Relays the page's
// Deep Focus state to the service worker and the emergency exit back to the page.
const ORIGIN = location.origin;

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== ORIGIN) return;
  const data = event.data;
  if (!data || data.source !== "ednova-focus-page" || typeof data.active !== "boolean") return;
  chrome.runtime.sendMessage({ type: "focus", active: data.active }).catch(() => {});
  window.postMessage({ source: "ednova-focus-guard", type: "ready" }, ORIGIN);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "exit") {
    window.postMessage({ source: "ednova-focus-guard", type: "exit" }, ORIGIN);
  }
});
