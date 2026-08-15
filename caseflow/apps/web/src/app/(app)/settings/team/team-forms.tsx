'use client';

import { UserPlus } from 'lucide-react';
import { useActionState } from 'react';
import { FormDialog } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { inviteTeamMember, updateTeamMember } from '@/lib/actions';
import type { Role } from '@/lib/types';

const ROLES: Array<{ value: Role; label: string; hint: string }> = [
  { value: 'ADMIN', label: 'Admin', hint: 'Settings, team, workflows, integrations' },
  { value: 'MANAGER', label: 'Manager', hint: 'Clients and cases' },
  { value: 'SPECIALIST', label: 'Specialist', hint: 'Only cases assigned to them' },
];

export function InviteMemberDialog() {
  return (
    <FormDialog
      trigger={
        <Button>
          <UserPlus />
          Add member
        </Button>
      }
      title="Add a team member"
      description="They sign in with a magic link sent to this address."
      action={inviteTeamMember}
      submitLabel="Add member"
      pendingLabel="Adding…"
    >
      <Field label="Name">
        <Input name="name" required autoFocus />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required />
      </Field>
      <Field label="Role">
        <Select name="role" defaultValue="SPECIALIST">
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label} — {role.hint}
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
        <option value="OWNER">Owner</option>
        {ROLES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)]">
        <input type="checkbox" name="isActive" defaultChecked={isActive} disabled={disabled} className="h-4 w-4 rounded" />
        Active
      </label>
      <SubmitButton variant="secondary" size="sm" disabled={disabled} pendingLabel="Saving…">
        Save
      </SubmitButton>
      {!state.ok && state.message ? (
        <span className="text-xs text-[var(--color-danger)]">{state.message}</span>
      ) : null}
    </form>
  );
}
