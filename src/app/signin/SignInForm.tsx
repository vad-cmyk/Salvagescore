'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.');
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="font-mono text-sm text-[var(--text-secondary)]">
          Magic link sent to{' '}
          <span className="text-[var(--text-primary)]">{email}</span>.
        </p>
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
          Check your inbox — link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-mono text-[0.65rem] text-[var(--text-muted)] mb-2 uppercase tracking-widest">
          Email address
        </label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--amber)] transition-colors"
        />
      </div>
      {error && (
        <p className="font-mono text-[0.65rem] text-[#DC2626]">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--amber)] text-[#0A0B0E] font-mono font-[700] text-sm py-3 rounded-lg hover:bg-[var(--amber-bright)] transition-colors disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  );
}
