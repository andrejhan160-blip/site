'use client';

import { Plus } from 'lucide-react';
import { FormDialog } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { createClient } from '@/lib/actions';

export function NewClientDialog() {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          New client
        </Button>
      }
      title="Create client"
      description="The client gets portal access by email — no password to set."
      action={createClient}
      submitLabel="Create client"
      pendingLabel="Creating…"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input name="firstName" required autoFocus />
        </Field>
        <Field label="Last name">
          <Input name="lastName" required />
        </Field>
      </div>
      <Field label="Email">
        <Input name="email" type="email" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <Input name="phone" />
        </Field>
        <Field label="CRM contact ID" hint="Optional — links to your Bitrix24 contact.">
          <Input name="externalCrmContactId" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" rows={3} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createPortalAccess" defaultChecked className="h-4 w-4 rounded" />
        Create a portal account for this client
      </label>
    </FormDialog>
  );
}
