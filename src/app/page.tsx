import Link from 'next/link';
import { HomeMarketingSections } from './HomeMarketingSections';

export default function Home() {
  return (
    <main>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="inline-block bg-white rounded-lg px-2 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="SalvageScore" className="h-7 w-auto" />
          </Link>
          <Link
            href="/check"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--amber)] text-[#0A0B0E] font-display font-[700] text-sm uppercase tracking-[0.06em] hover:opacity-90 transition-opacity"
          >
            Analyse a lot
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7.5 4l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </nav>

      <HomeMarketingSections />
    </main>
  );
}
