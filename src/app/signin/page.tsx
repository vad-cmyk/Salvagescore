import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import SignInForm from './SignInForm';

export const metadata: Metadata = { title: 'Sign in — SalvageScore' };

export default async function SignInPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/history');

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-[700] text-[var(--text-primary)] tracking-tight mb-2">
            Sign in
          </h1>
          <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>
        <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <Suspense>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
