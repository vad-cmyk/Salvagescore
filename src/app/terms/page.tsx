import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — SalvageScore',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-12 md:px-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-8">
          ← Back to home
        </Link>

        <h1 className="font-display font-[800] text-[clamp(2rem,5vw,2.8rem)] leading-tight tracking-[-0.01em] mb-2">
          Terms of Service
        </h1>
        <p className="font-mono text-xs text-[var(--text-muted)] mb-10">Last updated: June 2026</p>

        <div className="space-y-8 font-mono text-sm text-[var(--text-secondary)] leading-[1.8]">

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">1. About SalvageScore</h2>
            <p>SalvageScore (&quot;the service&quot;) is an AI-powered research tool that analyses salvage auction listings and produces cost estimates, damage assessments, and market comparisons. It is operated by Optimalis Ltd, London, UK.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">2. Not financial or professional advice</h2>
            <p>All reports, estimates, verdicts, and scores produced by SalvageScore are for informational and research purposes only. They do not constitute financial, legal, mechanical, or professional advice of any kind.</p>
            <p className="mt-3">All figures are AI-generated estimates and may be materially incorrect. Auction bids are legally binding contracts. You are solely responsible for any purchasing decisions you make. Always inspect vehicles in person, obtain independent bodyshop quotes, and carry out a full history check before bidding.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">3. Acceptable use</h2>
            <p>You may use SalvageScore for personal research into auction vehicles. You may not:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Scrape, crawl, or systematically download reports or data</li>
              <li>Resell or redistribute reports without permission</li>
              <li>Use the service to build a competing product</li>
              <li>Submit URLs that are not legitimate auction listings</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">4. Service availability</h2>
            <p>SalvageScore is provided &quot;as is&quot; without any guarantee of uptime, accuracy, or continued availability. We may modify, suspend, or discontinue the service at any time. During the free launch period, we may introduce pricing at our discretion with reasonable notice.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">5. Limitation of liability</h2>
            <p>To the maximum extent permitted by law, SalvageScore and its operators are not liable for any direct, indirect, or consequential loss arising from your use of the service or any purchasing decisions made based on a report.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">6. Governing law</h2>
            <p>These terms are governed by the laws of England and Wales.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">7. Contact</h2>
            <p>
              Questions:{' '}
              <a href="mailto:vad@salvagescore.com" className="text-[var(--amber)] hover:underline">vad@salvagescore.com</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
