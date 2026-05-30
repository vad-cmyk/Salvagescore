'use client';

import { useState } from 'react';

export function BodyshopSpec({ spec }: { spec: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(spec).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-mono text-xs text-[var(--text-muted)] font-[600] uppercase tracking-wider">
            Bodyshop Repair Specification
          </p>
          <p className="font-mono text-[0.7rem] text-[var(--text-muted)] mt-0.5">
            Email this to 3 garages for competing quotes
          </p>
        </div>
        <button
          onClick={copy}
          className={`no-print inline-flex items-center gap-2 font-mono text-xs font-[600] px-4 py-2 rounded-lg border transition-colors cursor-pointer ${
            copied
              ? 'border-[#22C55E]/40 text-[#22C55E] bg-[rgba(34,197,94,0.08)]'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] bg-[var(--bg-elevated)]'
          }`}
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5l3 3 6-6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Copied to clipboard
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2 8.5V2.5a.5.5 0 01.5-.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Copy spec
            </>
          )}
        </button>
      </div>
      <pre className="font-mono text-[0.65rem] text-[var(--text-muted)] leading-[1.7] bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto whitespace-pre max-h-64 overflow-y-auto">
        {spec}
      </pre>
    </div>
  );
}
