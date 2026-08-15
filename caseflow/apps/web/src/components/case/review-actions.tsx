'use client';

import { Check, X } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { reviewDocument } from '@/lib/actions';

/** Approve in one click; rejecting always requires a reason the client will read. */
export function ReviewActions({
  documentId,
  caseId,
  filename,
}: {
  documentId: string;
  caseId: string;
  filename: string;
}) {
  const [approveState, approveAction] = useActionState(reviewDocument, idleState);
  const [rejectState, rejectAction] = useActionState(reviewDocument, idleState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (rejectState.done && rejectState.ok) setOpen(false);
  }, [rejectState]);

  return (
    <div className="flex items-center gap-2">
      <form action={approveAction}>
        <input type="hidden" name="documentId" value={documentId} />
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="decision" value="APPROVE" />
        <SubmitButton variant="success" size="sm" pendingLabel="Принимаем…">
          <Check />
          Принять
        </SubmitButton>
      </form>

      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <X />
        Отклонить
      </Button>

      {!approveState.ok && approveState.message ? (
        <span className="text-xs text-[var(--color-danger)]">{approveState.message}</span>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Отклонить документ"
          description={`${filename} — клиент увидит эту причину и загрузит замену.`}
        >
          <form action={rejectAction} className="space-y-4">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="decision" value="REJECT" />
            <Field label="Причина отказа" hint="Напишите конкретно, что не так — клиент увидит только это.">
              <Textarea
                name="rejectionReason"
                required
                rows={4}
                autoFocus
                placeholder="Например: полис истекает раньше конца запрошенного срока. Загрузите полис на все 12 месяцев."
              />
            </Field>
            {!rejectState.ok && rejectState.message ? (
              <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {rejectState.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <SubmitButton variant="danger" pendingLabel="Отклоняем…">
                Отклонить документ
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
