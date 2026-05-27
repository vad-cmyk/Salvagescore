'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClaimReportForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const trimmed = value.trim();
    const slug = trimmed.split('/').filter(Boolean).pop() ?? trimmed;

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ text: 'Report added to your history.', ok: true });
        setValue('');
        router.refresh();
      } else if (data.reason === 'already_owned') {
        setMessage({ text: 'This report is already saved to an account.', ok: false });
      } else {
        setMessage({ text: data.error ?? 'Could not claim this report. Check the slug and try again.', ok: false });
      }
    } catch {
      setMessage({ text: 'Network error. Please try again.', ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a report URL or slug…"
          className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--amber)] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="shrink-0 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg font-mono text-[0.7rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Claim'}
        </button>
      </form>
      {message && (
        <p className={`mt-2 font-mono text-[0.65rem] ${message.ok ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
