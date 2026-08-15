'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { setTaskStatus } from '@/lib/actions';
import type { TaskStatus } from '@/lib/types';

export function TaskToggle({
  taskId,
  caseId,
  status,
}: {
  taskId: string;
  caseId?: string;
  status: TaskStatus;
}) {
  const [state, formAction] = useActionState(setTaskStatus, idleState);
  const next: TaskStatus = status === 'COMPLETED' ? 'OPEN' : 'COMPLETED';

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      {caseId ? <input type="hidden" name="caseId" value={caseId} /> : null}
      <input type="hidden" name="status" value={next} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Сохраняем…">
        {status === 'COMPLETED' ? 'Вернуть в работу' : 'Отметить выполненной'}
      </SubmitButton>
      {!state.ok && state.message ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
