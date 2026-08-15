'use client';

import { Upload } from 'lucide-react';
import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { idleState } from '@/lib/action-state';
import { uploadDocument } from '@/lib/actions';

/**
 * File picker that submits as soon as a file is chosen. Validation is enforced
 * again on the server — the accept list is a convenience, not a control.
 */
export function UploadForm({
  caseId,
  requirementId,
  portal = false,
  label = 'Upload',
  variant = 'primary',
  size = 'sm',
}: {
  caseId: string;
  requirementId?: string;
  portal?: boolean;
  label?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
}) {
  const [state, formAction] = useActionState(uploadDocument, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="caseId" value={caseId} />
      {requirementId ? <input type="hidden" name="requirementId" value={requirementId} /> : null}
      {portal ? <input type="hidden" name="portal" value="true" /> : null}
      <input
        ref={inputRef}
        type="file"
        name="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx"
        onChange={(event) => {
          if (event.target.files?.length) formRef.current?.requestSubmit();
        }}
      />
      <Button type="button" variant={variant} size={size} onClick={() => inputRef.current?.click()}>
        <Upload />
        {label}
      </Button>
      {!state.ok && state.message ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
