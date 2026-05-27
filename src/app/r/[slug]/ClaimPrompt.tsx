'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ClaimPrompt({
  slug,
  isLoggedIn,
  isOwned,
}: {
  slug: string;
  isLoggedIn: boolean;
  isOwned: boolean;
}) {
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isOwned || claimed) return null;

  if (!isLoggedIn) {
    return (
      <div className="mb-4 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-3">
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
          Sign in to save this report to your history.
        </p>
        <Link
          href={`/signin?next=/r/${slug}`}
          className="shrink-0 font-mono text-[0.65rem] text-[var(--amber)] hover:text-[var(--amber-bright)] transition-colors"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  async function handleClaim() {
    setLoading(true);
    await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    setClaimed(true);
    setLoading(false);
  }

  return (
    <div className="mb-4 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between gap-3">
      <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
        Add this report to your history.
      </p>
      <button
        onClick={handleClaim}
        disabled={loading}
        className="shrink-0 font-mono text-[0.65rem] text-[var(--amber)] hover:text-[var(--amber-bright)] transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save to history →'}
      </button>
    </div>
  );
}
