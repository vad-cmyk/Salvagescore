import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NavAuth } from './NavAuth';

export const metadata: Metadata = {
  title: 'SalvageScore — Auction Analysis for US & UK Buyers',
  description:
    'Paste a salvage auction URL. Get AI damage analysis, full cost breakdown, and a go/no-go verdict in 90 seconds. Built for US and UK buyers.',
  openGraph: {
    title: 'SalvageScore — Auction Analysis for US & UK Buyers',
    description:
      'Paste a salvage auction URL. Get AI damage analysis, full cost breakdown, and a go/no-go verdict in 90 seconds.',
    url: 'https://salvagescore.com',
    siteName: 'SalvageScore',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SalvageScore — Auction Analysis for US & UK Buyers',
    description:
      'AI damage analysis, full cost breakdown, and go/no-go verdict in 90 seconds. Free during launch.',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Auth service unavailable — render as logged out
  }

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
        <header className="no-print fixed top-0 left-0 right-0 z-50 p-4 flex items-center justify-between">
          <Link href="/" className="font-mono text-[0.7rem] font-[600] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors tracking-widest uppercase">
            SalvageScore
          </Link>
          <div className="flex items-center gap-4">
            <NavAuth user={user} />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
