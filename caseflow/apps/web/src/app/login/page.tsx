import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Вход' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [profile, { error }] = await Promise.all([getProfile(), searchParams]);
  if (profile) redirect(profile.role === 'CLIENT' ? '/portal' : '/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)] text-lg font-semibold text-white">
            C
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Вход в CaseFlow</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Клиентские процессы для команд, которые ведут долгие дела.
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 card-shadow">
          {error ? (
            <p className="mb-4 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2.5 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
