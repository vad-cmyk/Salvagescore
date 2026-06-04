'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ss_launch_dismissed';

export function LaunchBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — don't show
    }
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="no-print relative bg-[rgba(217,119,6,0.12)] border-b border-[rgba(217,119,6,0.25)] px-4 py-2.5 flex items-center justify-center gap-3">
      <span className="font-mono text-xs text-[var(--amber)] leading-snug text-center">
        Free reports while we launch — no card required
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 ml-2 text-[var(--amber)]/60 hover:text-[var(--amber)] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
