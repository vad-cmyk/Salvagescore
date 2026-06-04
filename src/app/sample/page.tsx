import type { Metadata } from 'next';
import Link from 'next/link';
import { SampleReports } from './SampleReports';

export const metadata: Metadata = {
  title: 'Sample Reports — SalvageScore',
  description: 'See full sample AI auction analysis reports for a UK domestic Cat N buy, a US→UK import, and a US domestic purchase.',
  openGraph: {
    title: 'Sample Reports — SalvageScore',
    description: 'See what a full SalvageScore report looks like before running your own analysis.',
  },
};

export default function SamplePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 md:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="animate-fade-up stagger-1 mb-10">
          <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-6">
            ← Back to home
          </Link>
          <p className="font-mono text-xs text-[var(--amber)] uppercase tracking-[0.2em] mb-3">Sample reports</p>
          <h1 className="font-display font-[800] text-[clamp(2rem,5vw,3rem)] leading-tight tracking-[-0.01em] mb-4">
            See what you get
          </h1>
          <p className="font-mono text-[0.875rem] text-[var(--text-secondary)] leading-[1.75] max-w-2xl">
            Three complete mock reports — a UK domestic Cat N buy, a US→UK import, and a US domestic purchase. All sections shown with realistic data. Real reports are generated live from the actual listing in about 90 seconds.
          </p>
          <Link
            href="/check"
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--amber)] text-[#0A0B0E] font-display font-[700] text-sm uppercase tracking-[0.06em] hover:opacity-90 transition-opacity shadow-[0_6px_20px_rgba(217,119,6,0.25)]"
          >
            Get a free report
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        <SampleReports />

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="font-mono text-sm text-[var(--text-muted)] mb-4">Ready to analyse your own lot?</p>
          <Link
            href="/check"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--amber)] text-[#0A0B0E] font-display font-[700] text-sm uppercase tracking-[0.06em] hover:opacity-90 transition-opacity"
          >
            Get a free report →
          </Link>
        </div>

      </div>
    </div>
  );
}
