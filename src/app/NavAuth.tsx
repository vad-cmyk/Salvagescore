'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

type NavUser = { email?: string | null; id: string } | null;

export function NavAuth({ user }: { user: NavUser }) {
  const pathname = usePathname();

  // Homepage has its own nav with CTA — don't show auth links there
  if (pathname === '/') return null;

  if (!user) {
    return (
      <Link
        href="/signin"
        className="font-mono text-[0.65rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        Sign in
      </Link>
    );
  }

  return (
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
  );
}
