'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from './button';

/** Submit control that reflects the pending state of its enclosing form. */
export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (pendingLabel ?? 'Сохраняем…') : children}
    </Button>
  );
}
