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

const unblock = () => chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID] });

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

// Discourage tab switching: any tab on another site sends you straight back.
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
  await returnToStudy(state);
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
