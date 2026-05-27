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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
      <div class="url-display">${escapeHtml(truncateUrl(url))}</div>
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
      <p class="error-text">${escapeHtml(message || 'Something went wrong.')}</p>
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
