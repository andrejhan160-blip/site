'use client';

import { useActionState } from 'react';
import { Field, Input, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { updateOrganization } from '@/lib/actions';
import type { Organization } from '@/lib/types';

export function BrandingForm({ organization }: { organization: Organization }) {
  const [state, formAction] = useActionState(updateOrganization, idleState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name">
          <Input name="name" defaultValue={organization.name} required />
        </Field>
        <Field label="Support email" hint="Shown to clients in the portal footer.">
          <Input name="supportEmail" type="email" defaultValue={organization.supportEmail ?? ''} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo URL" hint="Square image works best.">
          <Input name="logoUrl" type="url" defaultValue={organization.logoUrl ?? ''} placeholder="https://…" />
        </Field>
        <Field label="Primary colour" hint="Used across both apps and in emails.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="primaryColor"
              defaultValue={organization.primaryColor}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--color-border-strong)] bg-transparent p-1"
              aria-label="Primary colour"
            />
            <span className="text-sm text-[var(--color-ink-muted)]">{organization.primaryColor}</span>
          </div>
        </Field>
      </div>

      <Field label="Portal welcome text" hint="The first thing a client reads when they sign in.">
        <Textarea name="portalWelcomeText" rows={3} defaultValue={organization.portalWelcomeText ?? ''} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone" hint="Used for deadlines and activity timestamps.">
          <Input name="timezone" defaultValue={organization.timezone} />
        </Field>
        <Field
          label="Custom domain"
          hint="Stored now, routed once custom domains ship. Example: portal.yourcompany.com"
        >
          <Input name="customDomain" defaultValue={organization.customDomain ?? ''} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save branding</SubmitButton>
        {state.message ? (
          <p className={state.ok ? 'text-sm text-[var(--color-success)]' : 'text-sm text-[var(--color-danger)]'}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
