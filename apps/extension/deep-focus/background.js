// Deep Focus guard. Blocks other sites only while an EdNova tab says a session
// is active, and fails open: a missing heartbeat, a browser restart or the
// emergency exit all remove the block.
const RULE_ID = 1;
const BEAT_TIMEOUT_MS = 150_000;

const getState = async () => (await chrome.storage.session.get("state")).state ?? { active: false, off: false };
const setState = (state) => chrome.storage.session.set({ state });

async function block(host) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        priority: 1,
        action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
        condition: {
          regexFilter: "^https?://",
          resourceTypes: ["main_frame"],
          excludedRequestDomains: [host],
        },
      },
    ],
  });
}

const unblock = async () => {
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID] });
  await uncoverAll();
};

// ---- In-place blocking of other tabs -------------------------------------------------
// Runs inside the other page (isolated world). Must be self-contained.
function coverPage() {
  const ID = "ednova-deep-focus-overlay";
  if (document.getElementById(ID)) return;
  document.querySelectorAll("video,audio").forEach((media) => media.pause());
  const host = document.createElement("div");
  host.id = ID;
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      .wrap{position:fixed;inset:0;display:grid;place-items:center;background:#0f1226;color:#e8eaf6;font:16px/1.5 system-ui,sans-serif}
      main{max-width:28rem;padding:2rem}
      h1{font-size:1.5rem;margin:0 0 .5rem}
      p{color:#aab0d0;margin:.5rem 0 1.25rem}
      button{font:inherit;padding:.6rem 1rem;border-radius:.5rem;border:1px solid #5560a8;background:#7c5cff;color:#fff;cursor:pointer;margin:0 .5rem .5rem 0}
      button.ghost{background:transparent;color:#e8eaf6}
    </style>
    <div class="wrap" role="alertdialog" aria-modal="true" aria-label="Deep Focus is on">
      <main>
        <h1>Deep Focus is on</h1>
        <p>This tab is paused while your EdNova study session is active. Nothing here is lost.</p>
        <button id="back">Back to my session</button>
        <button id="exit" class="ghost">Emergency exit: turn off Deep Focus</button>
      </main>
    </div>`;
  root.getElementById("back").addEventListener("click", () => chrome.runtime.sendMessage({ type: "back" }));
  root.getElementById("exit").addEventListener("click", () => chrome.runtime.sendMessage({ type: "exit" }));
  document.documentElement.appendChild(host);
  if (document.body) document.body.inert = true;
  document.documentElement.style.overflow = "hidden";
}

function uncoverPage() {
  document.getElementById("ednova-deep-focus-overlay")?.remove();
  if (document.body) document.body.inert = false;
  document.documentElement.style.overflow = "";
}

async function cover(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: coverPage });
    return true;
  } catch {
    return false; // chrome://, the Web Store, the new-tab page, ...
  }
}

async function uncoverAll() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) =>
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: uncoverPage }).catch(() => {}),
    ),
  );
}


async function stop() {
  const state = await getState();
  await setState({ ...state, active: false });
  await chrome.alarms.clear("beat");
  await unblock();
}

// Chrome refuses tab changes while the mouse is still down on the tab strip
// ("Tabs cannot be edited right now"), so keep trying for a moment.
async function returnToStudy(state) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      await chrome.tabs.update(state.tabId, { active: true });
      if (state.windowId != null) await chrome.windows.update(state.windowId, { focused: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const current = await getState();
      if (!current.active) return; // exited meanwhile
    }
  }
}

// Emergency exit: unblock and tell the EdNova tab to end its session.
async function emergencyExit() {
  const state = await getState();
  await setState({ active: false, off: true });
  await chrome.alarms.clear("beat");
  await unblock();
  if (state.tabId != null) chrome.tabs.sendMessage(state.tabId, { type: "exit" }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  (async () => {
    if (message.type === "focus" && sender.tab?.url) {
      const state = await getState();
      if (!message.active) {
        // Session ended on the page: forget the emergency flag so the next one works.
        await setState({ active: false, off: false });
        await chrome.alarms.clear("beat");
        await unblock();
      } else if (!state.off) {
        const host = new URL(sender.tab.url).hostname;
        const wasActive = state.active;
        await setState({ active: true, off: false, host, tabId: sender.tab.id, windowId: sender.tab.windowId, lastBeat: Date.now() });
        if (!wasActive) {
          await block(host);
          await chrome.alarms.create("beat", { periodInMinutes: 1 });
        }
      }
    } else if (message.type === "exit") {
      await emergencyExit();
    } else if (message.type === "back") {
      const state = await getState();
      if (state.tabId != null) await returnToStudy(state);
    }
    reply((await getState()));
  })();
  return true;
});

// Any tab on another site is covered the moment you open it.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getState();
  if (!state.active || tabId === state.tabId) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  let sameHost = false;
  try {
    sameHost = tab?.url ? new URL(tab.url).hostname === state.host : false;
  } catch {
    /* non-URL tab */
  }
  if (sameHost) return;
  // Cover the page in place; only pages Chrome won't let us touch get sent back.
  if (!(await cover(tabId))) await returnToStudy(state);
});

// A page that finishes loading while a session is active gets covered too.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  const state = await getState();
  if (!state.active || tabId === state.tabId) return;
  try {
    if (new URL(tab.url).hostname === state.host) return;
  } catch {
    return;
  }
  if (tab.active) await cover(tabId);
});

// Fail open if the EdNova tab stops reporting (closed, crashed, navigated away).
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "beat") return;
  const state = await getState();
  if (!state.active || Date.now() - (state.lastBeat ?? 0) > BEAT_TIMEOUT_MS) await stop();
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.active && state.tabId === tabId) await stop();
});

// Dynamic rules survive a browser restart, so never start blocked.
chrome.runtime.onStartup.addListener(stop);
chrome.runtime.onInstalled.addListener(stop);
