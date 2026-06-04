import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — SalvageScore',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-12 md:px-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors mb-8">
          ← Back to home
        </Link>

        <h1 className="font-display font-[800] text-[clamp(2rem,5vw,2.8rem)] leading-tight tracking-[-0.01em] mb-2">
          Privacy Policy
        </h1>
        <p className="font-mono text-xs text-[var(--text-muted)] mb-10">Last updated: June 2026</p>

        <div className="space-y-8 font-mono text-sm text-[var(--text-secondary)] leading-[1.8]">

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">What we collect</h2>
            <p>When you create an account, we collect your email address. We use this to send you a magic link for sign-in and to associate your saved reports with your account. We do not collect your name, payment details, or any other personal information.</p>
            <p className="mt-3">We log standard server-side request metadata (IP address, user agent, timestamp) for security and debugging purposes. These logs are retained for 30 days.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">How we use your data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To authenticate you and keep your report history accessible</li>
              <li>To send transactional emails (magic sign-in links only)</li>
              <li>To diagnose errors and improve the service</li>
            </ul>
            <p className="mt-3">We do not use your data for advertising, we do not sell it, and we do not share it with third parties except as required to operate the service (our infrastructure providers: Vercel for hosting, Supabase for the database).</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">Auction listing data</h2>
            <p>When you paste a lot URL, we fetch the listing details from the auction platform and pass photos to our AI provider (Anthropic) for analysis. We do not permanently store the raw photos. Generated reports are stored in our database and linked to your account if you are signed in.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">Your rights (GDPR)</h2>
            <p>If you are located in the UK or EU, you have the right to access, correct, or delete your personal data at any time. To request deletion of your account and all associated data, email us at{' '}
              <a href="mailto:vad@salvagescore.com" className="text-[var(--amber)] hover:underline">vad@salvagescore.com</a>
              . We will process your request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">Cookies</h2>
            <p>We use a single session cookie to keep you signed in. We do not use tracking, analytics, or advertising cookies.</p>
          </section>

          <section>
            <h2 className="font-display font-[700] text-lg text-[var(--text-primary)] mb-3">Contact</h2>
            <p>
              Questions about this policy:{' '}
              <a href="mailto:vad@salvagescore.com" className="text-[var(--amber)] hover:underline">vad@salvagescore.com</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
