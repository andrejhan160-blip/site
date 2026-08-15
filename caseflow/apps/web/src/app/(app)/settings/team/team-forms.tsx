'use client';

import { UserPlus } from 'lucide-react';
import { useActionState } from 'react';
import { FormDialog } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { inviteTeamMember, updateTeamMember } from '@/lib/actions';
import { ROLE_HINTS, ROLE_LABELS } from '@/lib/i18n';
import type { Role } from '@/lib/types';

const ROLES: Array<{ value: Exclude<Role, 'OWNER' | 'CLIENT'> }> = [
  { value: 'ADMIN' },
  { value: 'MANAGER' },
  { value: 'SPECIALIST' },
];

export function InviteMemberDialog() {
  return (
    <FormDialog
      trigger={
        <Button>
          <UserPlus />
          Добавить сотрудника
        </Button>
      }
      title="Новый сотрудник"
      description="Вход по ссылке, которая придёт на этот адрес."
      action={inviteTeamMember}
      submitLabel="Добавить"
      pendingLabel="Добавляем…"
    >
      <Field label="Имя">
        <Input name="name" required autoFocus />
      </Field>
      <Field label="Почта">
        <Input name="email" type="email" required />
      </Field>
      <Field label="Роль">
        <Select name="role" defaultValue="SPECIALIST">
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {ROLE_LABELS[role.value]} — {ROLE_HINTS[role.value]}
            </option>
          ))}
        </Select>
      </Field>
    </FormDialog>
  );
}

export function MemberRoleForm({
  userId,
  role,
  isActive,
  disabled,
}: {
  userId: string;
  role: Role;
  isActive: boolean;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(updateTeamMember, idleState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Select name="role" defaultValue={role} disabled={disabled} className="h-9 w-auto text-[13px]">
        <option value="OWNER">{ROLE_LABELS.OWNER}</option>
        {ROLES.map((option) => (
          <option key={option.value} value={option.value}>
            {ROLE_LABELS[option.value]}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)]">
        <input type="checkbox" name="isActive" defaultChecked={isActive} disabled={disabled} className="h-4 w-4 rounded" />
        Активен
      </label>
      <SubmitButton variant="secondary" size="sm" disabled={disabled} pendingLabel="Сохраняем…">
        Сохранить
      </SubmitButton>
      {!state.ok && state.message ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
