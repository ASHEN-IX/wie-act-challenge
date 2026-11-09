# EdNova Deep Focus (Chromium, Manifest V3)

Optional companion to in-app Deep Focus. A web page cannot block other sites or tabs; an extension can. Without it, Deep Focus still tracks active study time and nudges you back, but cannot block anything (the bar says so).

## Install (development)
1. `chrome://extensions` → enable Developer mode → **Load unpacked** → select this folder.
2. For a deployed EdNova origin, add it to `content_scripts[0].matches` in `manifest.json` (only `http://localhost:3000/*` is listed).

## What it does
While an EdNova tab reports an active session:
- Top-level navigations to any other site are redirected to a local "Deep Focus is on" page (`declarativeNetRequest`; the EdNova host is excluded).
- Opening or switching to a tab on another site covers it in place with a full-screen "Deep Focus is on" screen: the page is frozen, its audio/video paused, and nothing is lost. The cover is removed when the session ends. Pages Chrome won't let extensions touch (new tab, `chrome://`, Web Store) send you back to the EdNova tab instead.

## What it cannot do
- Block other apps, other browsers, or incognito windows (unless you allow the extension there).
- Stop you from opening `chrome://` pages, or disable the extension.
- Block sub-resources or already-loaded pages; only top-level navigations and tab switches.

## Safety (fails open)
- Emergency exit: the extension popup, the "Deep Focus is on" screen/page, and **Exit Deep Focus** in EdNova all unblock immediately and end the session.
- No heartbeat from the EdNova tab for 150 s, closing that tab, or restarting the browser removes the block.

## Privacy and permissions
`<all_urls>` host access (plus `scripting`) is required to redirect or cover any site. The extension stores only `{active, host, tabId}` in session storage, reads no page content, logs no browsing history and sends nothing anywhere. It talks to the page through same-window `postMessage`; the allowed host is taken from the tab, never from the message.
