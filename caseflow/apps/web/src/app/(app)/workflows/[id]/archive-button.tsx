'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { archiveWorkflowTemplate } from '@/lib/actions';

export function ArchiveWorkflowButton({ templateId }: { templateId: string }) {
  const [state, formAction] = useActionState(archiveWorkflowTemplate, idleState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="templateId" value={templateId} />
      <SubmitButton variant="ghost" pendingLabel="Archiving…">
        Archive
      </SubmitButton>
      {!state.ok && state.message ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
