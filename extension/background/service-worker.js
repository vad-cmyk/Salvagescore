const API_BASE = 'https://salvagescore.com';

// Keep the service worker alive while an analysis is running.
// Chrome MV3 can terminate workers after ~30s of inactivity.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Reading storage is enough to reset the idle timer.
    chrome.storage.local.get('analysisState');
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'analyse') return;
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

  // Ping every 20 seconds to prevent the service worker from being terminated.
  chrome.alarms.create('keepAlive', { periodInMinutes: 1 / 3 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3 * 60 * 1000); // 3 min hard timeout

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, buyerLocation }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Server error ${res.status}`);
    }

    const { slug } = await res.json();

    chrome.alarms.clear('keepAlive');
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
    clearTimeout(timeout);
    chrome.alarms.clear('keepAlive');
    const message = err.name === 'AbortError'
      ? 'Analysis timed out after 3 minutes. Please try again.'
      : err.message || 'Analysis failed. Please try again.';
    await chrome.storage.local.set({
      analysisState: {
        status: 'error',
        startedAt: null,
        slug: null,
        error: message,
      },
    });
  }
}
