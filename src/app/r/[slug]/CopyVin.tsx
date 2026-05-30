'use client';

import { useState } from 'react';

export function CopyVin({ vin }: { vin: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(vin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 font-mono text-sm font-[600] text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--text-muted)] rounded-lg px-3 py-2 transition-colors cursor-pointer"
    >
      <span className="tracking-widest">{vin}</span>
      <span className={`text-[0.65rem] font-[500] shrink-0 ${copied ? 'text-[#22C55E]' : 'text-[var(--text-muted)]'}`}>
        {copied ? '✓ Copied' : 'Copy'}
      </span>
    </button>
  );
}
