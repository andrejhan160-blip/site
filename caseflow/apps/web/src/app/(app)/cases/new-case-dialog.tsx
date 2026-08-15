'use client';

import { Plus } from 'lucide-react';
import { FormDialog } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { createCase } from '@/lib/actions';
import type { ClientListRow, TeamMember, WorkflowTemplateSummary } from '@/lib/types';

export function NewCaseDialog({
  clients,
  templates,
  team,
}: {
  clients: ClientListRow[];
  templates: WorkflowTemplateSummary[];
  team: TeamMember[];
}) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          New case
        </Button>
      }
      title="Open a case"
      description="The workflow is copied into the case. Later edits to the template leave this case untouched."
      action={createCase}
      submitLabel="Open case"
      pendingLabel="Opening…"
    >
      <Field label="Client">
        <Select name="clientId" required defaultValue="">
          <option value="" disabled>
            Choose a client
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.firstName} {client.lastName} — {client.email}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Workflow">
        <Select name="workflowTemplateId" required defaultValue="">
          <option value="" disabled>
            Choose a workflow
          </option>
          {templates
            .filter((template) => template.isActive)
            .map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.stages.length} stages)
              </option>
            ))}
        </Select>
      </Field>

      <Field label="Case title" hint="Defaults to the workflow name.">
        <Input name="title" placeholder="e.g. France Residence Permit — Ivan Petrov" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assigned to">
          <Select name="assignedUserId" defaultValue="">
            <option value="">Me</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="CRM deal ID" hint="Links this case to a Bitrix24 deal.">
          <Input name="externalCrmEntityId" />
        </Field>
      </div>

      <Field label="Description">
        <Textarea name="description" rows={3} />
      </Field>
    </FormDialog>
  );
}
