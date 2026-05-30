# Group D — Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that lets users run a CopartCheck analysis on any supported Copart or A Better Bid listing page with one click.

**Architecture:** The extension lives in `extension/` with no build step (plain HTML/JS). A background service worker makes the POST to `https://copartcheck.com/api/analyze` and opens the result tab. The popup reads the active tab URL, manages UI states, and coordinates with the service worker via `chrome.runtime.sendMessage`. Analysis state (`{ status, startedAt, slug, error }`) is persisted in `chrome.storage.local` so the popup shows the correct state even if closed and re-opened mid-analysis.

**Tech Stack:** Chrome Manifest V3, plain HTML/CSS/JS, `chrome.storage` API, `chrome.tabs` API, `chrome.runtime` messaging.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `extension/manifest.json` | Create | MV3 manifest — permissions, icons, popup entry point, service worker |
| `extension/icons/icon16.png` | Create | Placeholder — copy of `public/logo.png` |
| `extension/icons/icon48.png` | Create | Placeholder — copy of `public/logo.png` |
| `extension/icons/icon128.png` | Create | Placeholder — copy of `public/logo.png` |
| `extension/background/service-worker.js` | Create | Receives analyse message, calls API, writes state, opens result tab |
| `extension/popup/popup.html` | Create | Popup shell — all CSS, header, `#app` mount point |
| `extension/popup/popup.js` | Create | All popup logic — URL detection, state rendering, storage polling |

---

## Task 1: Scaffold — directory structure, manifest, icons

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/icons/icon16.png`
- Create: `extension/icons/icon48.png`
- Create: `extension/icons/icon128.png`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p extension/background extension/popup extension/icons
```

- [ ] **Step 2: Copy placeholder icons from the existing logo**

```bash
cp public/logo.png extension/icons/icon16.png
cp public/logo.png extension/icons/icon48.png
cp public/logo.png extension/icons/icon128.png
```

Chrome scales icons at runtime. These are functional placeholders — replace with properly sized icons before Chrome Web Store submission.

- [ ] **Step 3: Create `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "CopartCheck",
  "version": "1.0.0",
  "description": "One-click auction analysis for Copart and A Better Bid listings.",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://copartcheck.com/*"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 4: Verify the extension loads in Chrome**

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (toggle, top-right)
3. Click "Load unpacked" → select the `extension/` directory
4. Expected: a "CopartCheck" extension card appears with no red error badges

- [ ] **Step 5: Commit**

```bash
git add extension/
git commit -m "feat(group-d): scaffold extension — manifest, icons, directory structure"
```

---

## Task 2: Background service worker

**Files:**
- Create: `extension/background/service-worker.js`

The service worker listens for `{ action: 'analyse', url, buyerLocation }` messages, writes analysis state to `chrome.storage.local`, POSTs to the CopartCheck API, and opens the result tab on success.

- [ ] **Step 1: Create `extension/background/service-worker.js`**

```javascript
const API_BASE = 'https://copartcheck.com';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'analyse') return;
  // Respond synchronously so the popup knows the message was received,
  // then kick off the async work.
  sendResponse({ ok: true });
  runAnalysis(message.url, message.buyerLocation);
});

async function runAnalysis(url, buyerLocation) {
  await chrome.storage.local.set({
    analysisState: {
      status: 'running',
      startedAt: Date.now(),
      slug: null,
      error: null,
    },
  });

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, buyerLocation }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Server error ${res.status}`);
    }

    const { slug } = await res.json();

    await chrome.storage.local.set({
      analysisState: {
        status: 'done',
        startedAt: null,
        slug,
        error: null,
      },
    });

    chrome.tabs.create({ url: `${API_BASE}/r/${slug}` });
  } catch (err) {
    await chrome.storage.local.set({
      analysisState: {
        status: 'error',
        startedAt: null,
        slug: null,
        error: err.message || 'Analysis failed. Please try again.',
      },
    });
  }
}
```

- [ ] **Step 2: Verify the service worker registers**

1. Reload the extension on `chrome://extensions`
2. Click "Service Worker" (the "Inspect views" link on the extension card)
3. DevTools opens for the service worker — console should show no errors
4. Run in that console:
   ```javascript
   chrome.storage.local.get('analysisState', console.log)
   ```
   Expected: `{}` (no state set yet — correct)

- [ ] **Step 3: Commit**

```bash
git add extension/background/service-worker.js
git commit -m "feat(group-d): add background service worker — API call, state, tab open"
```

---

## Task 3: Popup HTML and styles

**Files:**
- Create: `extension/popup/popup.html`

The popup is 320px wide with a dark theme matching CopartCheck. All CSS lives here. The `#app` div is populated by `popup.js`.

- [ ] **Step 1: Create `extension/popup/popup.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CopartCheck</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 320px;
      background: #0A0B0E;
      color: #F0EDE8;
      font-family: ui-monospace, 'Courier New', monospace;
      font-size: 13px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 10px;
    }
    .header img { height: 22px; width: auto; }
    .header-title {
      font-size: 11px;
      font-weight: 700;
      color: #94A3B8;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .divider { height: 1px; background: #1E2028; }

    #app { padding: 14px 16px 16px; }

    .state { display: flex; flex-direction: column; gap: 12px; }
    .center { align-items: center; text-align: center; }

    .url-display {
      font-size: 11px;
      color: #94A3B8;
      word-break: break-all;
      padding: 7px 10px;
      background: #13151A;
      border: 1px solid #2A2D38;
      border-radius: 6px;
      line-height: 1.5;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .row-label { font-size: 11px; color: #94A3B8; }

    .toggle {
      display: flex;
      background: #13151A;
      border: 1px solid #2A2D38;
      border-radius: 6px;
      overflow: hidden;
    }
    .toggle-btn {
      padding: 5px 14px;
      background: transparent;
      color: #64748B;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
    }
    .toggle-btn.active { background: #D97706; color: #0A0B0E; }
    .toggle-btn:not(.active):hover { background: #1E2028; color: #F0EDE8; }

    .btn-primary {
      width: 100%;
      padding: 10px;
      background: #D97706;
      color: #0A0B0E;
      border: none;
      border-radius: 8px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-primary:hover { background: #F59E0B; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary {
      padding: 8px 20px;
      background: transparent;
      color: #94A3B8;
      border: 1px solid #2A2D38;
      border-radius: 8px;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-secondary:hover { border-color: #94A3B8; color: #F0EDE8; }

    .muted { font-size: 11px; color: #64748B; line-height: 1.6; }
    .title { font-size: 14px; font-weight: 700; color: #F0EDE8; }
    .elapsed {
      font-size: 32px;
      font-weight: 700;
      color: #F0EDE8;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }
    .done-check { font-size: 32px; color: #22C55E; }
    .error-text { font-size: 12px; color: #EF4444; line-height: 1.5; }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #2A2D38;
      border-top-color: #D97706;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="header">
    <img src="../icons/icon48.png" alt="" />
    <span class="header-title">CopartCheck</span>
  </div>
  <div class="divider"></div>
  <div id="app"></div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify the popup shell renders**

1. Reload the extension on `chrome://extensions`
2. Click the CopartCheck icon in the Chrome toolbar (pin it via the puzzle-piece menu if needed)
3. Expected: a 320px dark popup opens showing the CopartCheck logo + "COPARTCHECK" header text
4. The `#app` area is empty — that's correct (popup.js doesn't exist yet)

- [ ] **Step 3: Commit**

```bash
git add extension/popup/popup.html
git commit -m "feat(group-d): add popup HTML shell and styles"
```

---

## Task 4: Popup JS

**Files:**
- Create: `extension/popup/popup.js`

All popup logic: URL detection, reading/writing storage, rendering the five states, polling every 2s while running.

- [ ] **Step 1: Create `extension/popup/popup.js`**

```javascript
const STALENESS_MS = 3 * 60 * 1000; // 3 minutes

const SUPPORTED_PATTERNS = [
  /copart\.com\/lot\//i,
  /copart\.co\.uk\/lot\//i,
  /abetter\.bid\/(?:en\/)?lot\//i,
];

let pollTimer = null;

// ── Helpers ────────────────────────────────────────────────────────────────

function isSupported(url) {
  return typeof url === 'string' && SUPPORTED_PATTERNS.some((p) => p.test(url));
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 28 ? u.pathname.slice(0, 28) + '…' : u.pathname;
    return u.hostname + path;
  } catch {
    return url.slice(0, 40);
  }
}

function formatElapsed(startedAt) {
  const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function setApp(html) {
  document.getElementById('app').innerHTML = html;
}

// ── Poll management ────────────────────────────────────────────────────────

function stopPoll() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(async () => {
    const { analysisState } = await chrome.storage.local.get('analysisState');
    if (!analysisState || analysisState.status !== 'running') {
      if (analysisState?.status === 'done') renderDone(analysisState.slug);
      else if (analysisState?.status === 'error') renderError(analysisState.error);
      return;
    }
    const el = document.getElementById('elapsed');
    if (el) el.textContent = formatElapsed(analysisState.startedAt);
  }, 2000);
}

// ── State renderers ────────────────────────────────────────────────────────

function renderUnsupported() {
  stopPoll();
  setApp(`
    <div class="state center" style="padding:16px 0">
      <p class="muted">Open a Copart or A Better Bid<br>listing to get started.</p>
    </div>
  `);
}

function renderIdle(url, buyerLocation) {
  stopPoll();
  setApp(`
    <div class="state">
      <div class="url-display">${truncateUrl(url)}</div>
      <div class="row">
        <span class="row-label">Buyer location</span>
        <div class="toggle">
          <button class="toggle-btn${buyerLocation === 'uk' ? ' active' : ''}" data-loc="uk">UK</button>
          <button class="toggle-btn${buyerLocation === 'us' ? ' active' : ''}" data-loc="us">US</button>
        </div>
      </div>
      <button id="btn-analyse" class="btn-primary">Analyse →</button>
    </div>
  `);

  document.querySelectorAll('[data-loc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const loc = btn.dataset.loc;
      chrome.storage.sync.set({ buyerLocation: loc });
      renderIdle(url, loc);
    });
  });

  document.getElementById('btn-analyse').addEventListener('click', () => {
    const startedAt = Date.now();
    // Send message to service worker; handle the case where it's still waking up.
    chrome.runtime.sendMessage(
      { action: 'analyse', url, buyerLocation },
      (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          renderError('Could not start analysis — please try again.');
        }
      }
    );
    renderRunning(startedAt);
    startPoll();
  });
}

function renderRunning(startedAt) {
  stopPoll();
  setApp(`
    <div class="state center" style="padding:8px 0 4px">
      <div class="spinner"></div>
      <p class="title">Analysing…</p>
      <p id="elapsed" class="elapsed">${formatElapsed(startedAt)}</p>
      <p class="muted">Usually 60–90 seconds.<br>You can close this popup.</p>
    </div>
  `);
}

function renderDone(slug) {
  stopPoll();
  setApp(`
    <div class="state center" style="padding:8px 0 4px">
      <p class="done-check">✓</p>
      <p class="title">Report ready</p>
      <button id="btn-open" class="btn-primary">Open report →</button>
    </div>
  `);
  document.getElementById('btn-open').addEventListener('click', () => {
    chrome.tabs.create({ url: `https://copartcheck.com/r/${slug}` });
    window.close();
  });
}

function renderError(message) {
  stopPoll();
  setApp(`
    <div class="state center" style="padding:8px 0 4px">
      <p class="error-text">${message || 'Something went wrong.'}</p>
      <button id="btn-retry" class="btn-secondary">Try again</button>
    </div>
  `);
  document.getElementById('btn-retry').addEventListener('click', async () => {
    await chrome.storage.local.set({
      analysisState: { status: 'idle', startedAt: null, slug: null, error: null },
    });
    init();
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';

  const [{ analysisState }, syncData] = await Promise.all([
    chrome.storage.local.get('analysisState'),
    chrome.storage.sync.get({ buyerLocation: 'uk' }),
  ]);

  const state = analysisState ?? { status: 'idle', startedAt: null, slug: null, error: null };
  const { buyerLocation } = syncData;

  // Staleness guard: reset stuck running states older than 3 minutes
  if (
    state.status === 'running' &&
    state.startedAt !== null &&
    Date.now() - state.startedAt > STALENESS_MS
  ) {
    await chrome.storage.local.set({
      analysisState: { status: 'idle', startedAt: null, slug: null, error: null },
    });
    state.status = 'idle';
  }

  if (state.status === 'running') {
    renderRunning(state.startedAt);
    startPoll();
  } else if (state.status === 'done') {
    renderDone(state.slug);
  } else if (state.status === 'error') {
    renderError(state.error);
  } else if (isSupported(url)) {
    renderIdle(url, buyerLocation);
  } else {
    renderUnsupported();
  }
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 2: Verify popup on an unsupported page**

1. Reload the extension on `chrome://extensions`
2. Navigate to any non-Copart page (e.g. `https://google.com`)
3. Click the CopartCheck icon
4. Expected: "Open a Copart or A Better Bid listing to get started."

- [ ] **Step 3: Verify popup on a supported URL**

1. Navigate to any URL matching a Copart lot pattern — e.g. `https://www.copart.co.uk/lot/12345678` or `https://www.copart.com/lot/87654321` (the lot doesn't need to exist — we're testing URL matching only)
2. Click the CopartCheck icon
3. Expected: popup shows the truncated URL, "Buyer location" row with UK/US toggle (UK active by default), and "Analyse →" button

- [ ] **Step 4: Verify UK/US toggle persists**

1. With the popup open on a supported URL, click "US"
2. Close and re-open the popup
3. Expected: "US" is still selected

- [ ] **Step 5: Commit**

```bash
git add extension/popup/popup.js
git commit -m "feat(group-d): add popup JS — URL detection, state rendering, storage polling"
```

---

## Task 5: End-to-end verification

Verify the full analysis flow works against the local dev server, then revert local overrides so the extension points to production.

- [ ] **Step 1: Start the local dev server**

In the project root:
```bash
npm run dev
```

App runs at `http://localhost:3000`.

- [ ] **Step 2: Temporarily point the extension to localhost**

Edit `extension/background/service-worker.js`, line 1:
```javascript
// Change:
const API_BASE = 'https://copartcheck.com';
// To:
const API_BASE = 'http://localhost:3000';
```

Edit `extension/manifest.json`, add localhost to `host_permissions`:
```json
"host_permissions": ["https://copartcheck.com/*", "http://localhost:3000/*"],
```

Reload the extension on `chrome://extensions`.

- [ ] **Step 3: Test the full analysis flow**

1. Navigate to a real Copart or A Better Bid listing, e.g.:
   - `https://www.copart.co.uk/lot/` + a valid lot number
   - `https://www.abetter.bid/en/lot/` + a valid lot number
2. Click the CopartCheck icon
3. Expected: popup shows the URL, buyer toggle, "Analyse →" button
4. Click "Analyse →"
5. Expected: popup transitions to "Analysing…" with a running elapsed timer (e.g. `0:05`)
6. Wait 60–120 seconds
7. Expected: a new tab opens automatically to `http://localhost:3000/r/{slug}` with the full report
8. Re-open the popup
9. Expected: popup shows "✓" + "Report ready" + "Open report →" button
10. Click "Open report →": opens another tab to the same report

- [ ] **Step 4: Test close-and-reopen during analysis**

1. Start a fresh analysis (click "Try again" on the Done state first, or clear storage: in service worker DevTools → `chrome.storage.local.clear()`)
2. Click "Analyse →", then immediately close the popup (click away)
3. Wait 60–120 seconds
4. Expected: a new tab opens automatically when analysis completes (no popup needed)
5. Re-open the popup → Expected: "✓ Report ready" state

- [ ] **Step 5: Test error handling**

1. Stop the dev server (`Ctrl+C`)
2. Clear existing analysis state: service worker DevTools → `chrome.storage.local.clear()`
3. Click "Analyse →" on a supported listing
4. Expected: within a few seconds, popup shows a red error message and "Try again" button
5. Click "Try again" → Expected: popup resets to idle state showing the URL and "Analyse →" button
6. Restart the dev server

- [ ] **Step 6: Revert to production settings**

Edit `extension/background/service-worker.js` back:
```javascript
const API_BASE = 'https://copartcheck.com';
```

Edit `extension/manifest.json` back:
```json
"host_permissions": ["https://copartcheck.com/*"],
```

Reload the extension to verify no errors.

- [ ] **Step 7: Commit**

```bash
git add extension/background/service-worker.js extension/manifest.json
git commit -m "feat(group-d): revert to production API — extension complete"
```
