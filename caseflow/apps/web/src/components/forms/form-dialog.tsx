'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState, type ActionState } from '@/lib/action-state';

/**
 * Dialog wrapping a server action. Closes itself once the action reports
 * success, and surfaces the API's message when it does not.
 */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  submitLabel,
  pendingLabel,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, idleState);

  useEffect(() => {
    if (state.done && state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <form action={formAction} className="space-y-4">
          {children}
          {!state.ok && state.message ? (
            <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
