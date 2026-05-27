import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'CopartCheck — Auction Analysis for US & UK Buyers',
  description:
    'Paste a Copart or A Better Bid URL. Get AI damage analysis, full cost breakdown, and a go/no-go verdict in 90 seconds. Built for US and UK buyers.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0A0B0E] text-[#F0EDE8] antialiased min-h-screen">
        <header className="no-print fixed top-0 right-0 z-50 p-4 flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/history"
                className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                History
              </Link>
              <span className="hidden sm:block font-mono text-[0.6rem] text-[var(--text-muted)] max-w-[140px] truncate">
                {user.email ?? user.id}
              </span>
              <form method="POST" action="/api/auth/signout">
                <button
                  type="submit"
                  className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Sign in
            </Link>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
