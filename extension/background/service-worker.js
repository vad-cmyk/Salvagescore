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
