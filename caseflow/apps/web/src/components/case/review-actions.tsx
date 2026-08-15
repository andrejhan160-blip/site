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
        <SubmitButton variant="success" size="sm" pendingLabel="Approving…">
          <Check />
          Approve
        </SubmitButton>
      </form>

      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <X />
        Reject
      </Button>

      {!approveState.ok && approveState.message ? (
        <span className="text-xs text-[var(--color-danger)]">{approveState.message}</span>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Reject document"
          description={`${filename} — the client sees this reason and uploads a replacement.`}
        >
          <form action={rejectAction} className="space-y-4">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="decision" value="REJECT" />
            <Field label="Reason for rejection" hint="Be specific about what to fix — this is the whole message.">
              <Textarea
                name="rejectionReason"
                required
                rows={4}
                autoFocus
                placeholder="e.g. The policy expires before the end of the requested stay. Please upload one covering the full 12 months."
              />
            </Field>
            {!rejectState.ok && rejectState.message ? (
              <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {rejectState.message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="danger" pendingLabel="Rejecting…">
                Reject document
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
