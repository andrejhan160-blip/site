'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { requestMagicLink, type LoginState } from './actions';

const initialState: LoginState = { status: 'idle' };

export function LoginForm() {
  const [state, formAction] = useActionState(requestMagicLink, initialState);

  if (state.status === 'sent') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-success-soft)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-success)]">Check your inbox</p>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            If an account exists for that address, a sign-in link is on its way. It expires in 15 minutes.
          </p>
        </div>
        {state.devLink ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border-strong)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">
              Development mode
            </p>
            <Link href={state.devLink} className="mt-1 block text-sm font-medium break-all text-[var(--color-accent)]">
              Open the sign-in link
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Work email">
        <Input name="email" type="email" required placeholder="you@company.com" autoComplete="email" autoFocus />
      </Field>
      {state.status === 'error' && state.message ? (
        <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}
      <SubmitButton className="w-full" size="lg" pendingLabel="Sending link…">
        Send sign-in link
      </SubmitButton>
      <p className="text-center text-xs text-[var(--color-ink-muted)]">
        We email you a one-time link — no password to remember or leak.
      </p>
    </form>
  );
}
