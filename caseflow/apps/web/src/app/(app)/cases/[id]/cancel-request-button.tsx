'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { cancelRequest } from '@/lib/actions';

export function CancelRequestButton({ requestId, caseId }: { requestId: string; caseId: string }) {
  const [state, formAction] = useActionState(cancelRequest, idleState);

  return (
    <form action={formAction}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="caseId" value={caseId} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Cancelling…">
        Cancel
      </SubmitButton>
      {!state.ok && state.message ? (
        <span className="ml-2 text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
