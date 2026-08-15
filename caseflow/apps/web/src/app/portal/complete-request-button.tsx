'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { completeRequest } from '@/lib/actions';

export function CompleteRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(completeRequest, idleState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton size="sm" variant="secondary" pendingLabel="Сохраняем…">
        Отметить выполненным
      </SubmitButton>
      {!state.ok && state.message ? (
        <span className="text-right text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
