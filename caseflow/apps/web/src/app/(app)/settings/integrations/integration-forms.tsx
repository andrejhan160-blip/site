'use client';

import { useActionState } from 'react';
import { Field, Input, Select } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { saveCrmConnection, saveStageMappings, testCrmConnection } from '@/lib/actions';
import type { CrmSettings, WorkflowTemplateDetail } from '@/lib/types';

type Connection = CrmSettings['connections'][number];

export function ConnectionForm({ connection }: { connection: Connection | undefined }) {
  const [state, formAction] = useActionState(saveCrmConnection, idleState);

  return (
    <form action={formAction} className="space-y-5">
      <Field
        label="Inbound webhook URL"
        hint="Bitrix24 → Developer resources → Other → Inbound webhook. Grant the crm scope and paste the URL here."
      >
        <Input
          name="inboundWebhookUrl"
          type="url"
          placeholder="https://yourcompany.bitrix24.eu/rest/1/xxxxxxxxxxxx"
          defaultValue=""
        />
      </Field>
      {connection?.hasCredentials ? (
        <p className="-mt-3 text-xs text-[var(--color-success)]">
          Credentials are stored ({connection.configuredKeys.join(', ')}). Leave the field blank to keep them.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Portal address">
          <Input name="baseUrl" type="url" defaultValue={connection?.baseUrl ?? ''} placeholder="https://yourcompany.bitrix24.eu" />
        </Field>
        <Field label="Fields to sync" hint="Comma separated. Only these are read from the deal.">
          <Input
            name="syncedFields"
            defaultValue={connection?.syncedFields.join(', ') ?? 'TITLE, STAGE_ID, ASSIGNED_BY_ID, CONTACT_ID'}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={connection?.isActive ?? false} className="h-4 w-4 rounded" />
        Integration active — inbound webhooks are processed
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save connection</SubmitButton>
        {state.message ? (
          <p className={state.ok ? 'text-sm text-[var(--color-success)]' : 'text-sm text-[var(--color-danger)]'}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function TestConnectionButton({ connectionId }: { connectionId: string }) {
  const [state, formAction] = useActionState(testCrmConnection, idleState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="connectionId" value={connectionId} />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Testing…">
        Test connection
      </SubmitButton>
      {state.message ? (
        <span className={state.ok ? 'text-sm text-[var(--color-success)]' : 'text-sm text-[var(--color-danger)]'}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function StageMappingForm({
  connection,
  templates,
}: {
  connection: Connection;
  templates: WorkflowTemplateDetail[];
}) {
  const [state, formAction] = useActionState(saveStageMappings, idleState);

  if (connection.mappings.length === 0) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">
        No pipeline stages have been imported yet. Save the connection and run a test to pull them in, or add
        mappings through the API.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="connectionId" value={connection.id} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
              <th className="py-2 pr-4 font-medium">Bitrix pipeline</th>
              <th className="py-2 pr-4 font-medium">Bitrix stage</th>
              <th className="py-2 font-medium">CaseFlow workflow stage</th>
            </tr>
          </thead>
          <tbody>
            {connection.mappings.map((mapping) => (
              <tr key={mapping.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  {mapping.pipelineName ?? `Pipeline ${mapping.pipelineId}`}
                </td>
                <td className="py-3 pr-4">
                  <span className="font-medium">{mapping.externalStageName ?? mapping.externalStageId}</span>
                  <span className="block text-xs text-[var(--color-ink-subtle)]">{mapping.externalStageId}</span>
                  <input
                    type="hidden"
                    name="mapping"
                    value={JSON.stringify({
                      pipelineId: mapping.pipelineId,
                      pipelineName: mapping.pipelineName ?? '',
                      externalStageId: mapping.externalStageId,
                      externalStageName: mapping.externalStageName ?? '',
                    })}
                  />
                </td>
                <td className="py-3">
                  <Select
                    name={`stage:${mapping.externalStageId}`}
                    defaultValue={mapping.templateStageId ?? ''}
                    className="h-9 text-[13px]"
                  >
                    <option value="">Do not change the stage</option>
                    {templates.map((template) => (
                      <optgroup key={template.id} label={template.name}>
                        {template.stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.position + 1}. {stage.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save mapping</SubmitButton>
        {state.message ? (
          <p className={state.ok ? 'text-sm text-[var(--color-success)]' : 'text-sm text-[var(--color-danger)]'}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
