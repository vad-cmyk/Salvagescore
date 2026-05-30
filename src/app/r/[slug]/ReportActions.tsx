'use client';

import { useState } from 'react';

export function WhatsAppButton({ vehicleTitle, verdict, marginGbp }: { vehicleTitle: string; verdict: string; marginGbp: number }) {
  function share() {
    const url = window.location.href;
    const sign = marginGbp >= 0 ? '+' : '';
    const text = `Check out this SalvageScore report: ${vehicleTitle} — ${verdict.toUpperCase()} verdict, ${sign}£${Math.abs(marginGbp).toLocaleString('en-GB')} margin\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <button
      onClick={share}
      className="no-print inline-flex items-center gap-2 font-mono text-xs font-[600] px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[#25D366] hover:border-[#25D366]/50 transition-colors cursor-pointer bg-[var(--bg-surface)]"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      WhatsApp
    </button>
  );
}

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  function share() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <button
      onClick={share}
      className="no-print inline-flex items-center gap-2 font-mono text-xs font-[600] px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)] transition-colors cursor-pointer bg-[var(--bg-surface)]"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5l3 3 6-6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[#22C55E]">Link copied</span>
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M5 8.5l3-3m0 0l-1.5-1.5M8 5.5l1.5-1.5a2.121 2.121 0 013 3L11 9a2.121 2.121 0 01-3 0l-.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M8 7.5l-3 3a2.121 2.121 0 01-3-3l1.5-1.5A2.121 2.121 0 016.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Share report
        </>
      )}
    </button>
  );
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 font-mono text-xs font-[600] px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)] transition-colors cursor-pointer bg-[var(--bg-surface)]"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="2" y="4.5" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4.5 4.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4.5 9.5h4M4.5 7.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      Save PDF
    </button>
  );
}
