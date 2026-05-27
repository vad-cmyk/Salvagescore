# Group D — Browser Extension Design

Date: 2026-05-27

## Scope

A Chrome Manifest V3 extension that lets users run a CopartCheck analysis on any Copart or A Better Bid listing page with one click — no URL copying required. Lives in `extension/` inside the main repo. No build step (plain HTML/JS).

---

## Decisions

| Decision | Choice |
|---|---|
| Browser | Chrome only |
| Distribution | Chrome Web Store (public) |
| Manifest version | V3 |
| Buyer location | User-configurable (UK/US toggle, persisted in `chrome.storage.sync`) |
| Auth | Anonymous — reports can be claimed on CopartCheck after the fact |
| API calls | From background service worker (bypasses CORS with `host_permissions`) |
| Result delivery | Service worker opens report tab; popup shows live loading state |
| Build step | None — plain HTML/JS |

---

## File Structure

```
extension/
  manifest.json
  popup/
    popup.html
    popup.js
  background/
    service-worker.js
  icons/
    icon16.png
    icon48.png
    icon128.png
```

---

## Manifest

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

**Permissions rationale:**
- `activeTab` — read the current tab URL when the popup opens
- `storage` — persist buyer location preference and analysis state
- `host_permissions: ["https://copartcheck.com/*"]` — allows the service worker to POST to the API without CORS blocking

---

## Supported URL Patterns

The popup checks the active tab URL against these patterns:

| Domain | Pattern |
|---|---|
| Copart US | `copart.com/lot/` |
| Copart UK | `copart.co.uk/lot/` |
| A Better Bid | `abetter.bid/en/lot/` or `abetter.bid/lot/` |

If the URL does not match, the popup shows an "unsupported page" message.

---

## Analysis State

Stored in `chrome.storage.local` under key `analysisState`:

```js
{
  status: 'idle' | 'running' | 'done' | 'error',
  startedAt: number | null,   // Date.now() when analysis started
  slug: string | null,        // set on success
  error: string | null,       // set on failure
}
```

**Staleness guard:** If `status === 'running'` and `Date.now() - startedAt > 180_000` (3 minutes), the popup resets the state to `idle`. This handles the rare case where Chrome kills the service worker mid-flight.

---

## Buyer Location Preference

Stored in `chrome.storage.sync` under key `buyerLocation`. Default: `'uk'`.

Updated immediately when the user toggles UK/US in the popup. Syncs across the user's Chrome profile.

---

## Popup States

### Idle — Supported URL

- Displays truncated listing URL (hostname + path only, max 40 chars)
- UK / US toggle
- "Analyse →" button

### Idle — Unsupported URL

- Message: "Open a Copart or A Better Bid listing to get started."
- No button

### Running

- Spinner + "Analysing…" label
- Elapsed timer updating every second (format: `0:47`)
- Sub-label: "This usually takes 60–90 seconds"
- Note: user can close the popup — analysis continues in background and the result tab opens automatically

### Done

- "✓ Report ready" message
- "Open report →" button opening `https://copartcheck.com/r/{slug}` in a new tab
- The service worker also opens the tab automatically when analysis completes, so this state is brief

### Error

- Error message (from API or network)
- "Try again" button — resets `analysisState` to `idle`, returns to idle state

---

## Data Flow

```
popup.js                         service-worker.js
   |                                    |
   |-- chrome.tabs.query (active tab) --|
   |<- url                              |
   |                                    |
   |-- chrome.runtime.sendMessage ----->|
   |   { url, buyerLocation }           |
   |                                    |
   |                  chrome.storage.local.set({ status: 'running', startedAt })
   |                                    |
   |                      POST /api/analyze (up to 120s)
   |                                    |
   |         [success]                  |
   |                  chrome.storage.local.set({ status: 'done', slug })
   |                  chrome.tabs.create({ url: copartcheck.com/r/{slug} })
   |                                    |
   |         [failure]                  |
   |                  chrome.storage.local.set({ status: 'error', error })
   |                                    |
popup.js polls chrome.storage.local every 2s while status === 'running'
```

---

## Popup Implementation Notes

- `popup.js` calls `chrome.tabs.query({ active: true, currentWindow: true })` to get the current URL
- On open, reads `chrome.storage.local` to check for in-flight or completed analysis
- While status is `'running'`, polls `chrome.storage.local` every 2 seconds and updates the elapsed timer from `startedAt`
- When status flips to `'done'`, shows Done state (tab already opened by service worker)
- UK/US toggle reads from `chrome.storage.sync` on load, writes on change

---

## Service Worker Implementation Notes

- Listens for `chrome.runtime.onMessage` with action `'analyse'`
- Sets `analysisState` to `running` before the fetch
- Uses `fetch` with `method: 'POST'`, `Content-Type: application/json`, body `{ url, buyerLocation }`
- No `credentials: 'include'` — analysis is anonymous
- On success: sets state to `done`, calls `chrome.tabs.create`
- On any error (network failure, non-ok HTTP status, timeout): sets state to `error` with a human-readable message
- The active `fetch` keeps the service worker alive for the duration of the request

---

## Styling

The popup matches CopartCheck's dark aesthetic:
- Background: `#0A0B0E`
- Text: `#F0EDE8` (primary), `#94A3B8` (muted)
- Accent: `#D97706` (amber — for the Analyse button and spinner)
- Font: system monospace (`font-family: ui-monospace, 'IBM Plex Mono', monospace`)
- Popup width: 320px
- No external font dependencies (Chrome Web Store prefers self-contained extensions)

---

## Edge Cases

| Scenario | Handling |
|---|---|
| User navigates away before clicking Analyse | Popup reads new URL on next open — no stale state |
| Analysis running, user re-opens popup | Popup detects `status: 'running'`, shows loading state with correct elapsed time |
| Service worker killed mid-flight | State stays `'running'`; staleness guard (3 min) resets to `idle` on next popup open |
| Network error / API 500 | Caught, stored as `status: 'error'` with message |
| User clicks Analyse on a running analysis | Button disabled while `status === 'running'` |
| `buyerLocation` not yet set | Defaults to `'uk'` |

---

## Out of Scope

- Firefox support
- Safari support
- Inline report preview within the extension popup
- Auth / session cookie forwarding
- Offline support
- Context menu (right-click) integration
