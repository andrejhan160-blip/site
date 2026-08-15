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
          <p className="text-sm font-medium text-[var(--color-success)]">Проверьте почту</p>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Если аккаунт с таким адресом существует, ссылка для входа уже отправлена. Она действует 15 минут.
          </p>
        </div>
        {state.devLink ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border-strong)] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">
              Режим разработки
            </p>
            <Link href={state.devLink} className="mt-1 block text-sm font-medium break-all text-[var(--color-accent)]">
              Открыть ссылку для входа
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Рабочая почта">
        <Input name="email" type="email" required placeholder="vy@company.ru" autoComplete="email" autoFocus />
      </Field>
      {state.status === 'error' && state.message ? (
        <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}
      <SubmitButton className="w-full" size="lg" pendingLabel="Отправляем ссылку…">
        Получить ссылку для входа
      </SubmitButton>
      <p className="text-center text-xs text-[var(--color-ink-muted)]">
        Отправим одноразовую ссылку на почту — пароль не нужен: его нечего забывать и нечего украсть.
      </p>
    </form>
  );
}
