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
        label="Адрес входящего вебхука"
        hint="Битрикс24 → Разработчикам → Другое → Входящий вебхук. Выдайте право crm и вставьте адрес сюда."
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
          Доступы сохранены ({connection.configuredKeys.join(', ')}). Оставьте поле пустым, чтобы их не менять.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Адрес портала">
          <Input name="baseUrl" type="url" defaultValue={connection?.baseUrl ?? ''} placeholder="https://yourcompany.bitrix24.eu" />
        </Field>
        <Field label="Поля для синхронизации" hint="Через запятую. Только они читаются из сделки.">
          <Input
            name="syncedFields"
            defaultValue={connection?.syncedFields.join(', ') ?? 'TITLE, STAGE_ID, ASSIGNED_BY_ID, CONTACT_ID'}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={connection?.isActive ?? false} className="h-4 w-4 rounded" />
        Интеграция включена — входящие вебхуки обрабатываются
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Сохраняем…">Сохранить подключение</SubmitButton>
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
      <SubmitButton variant="secondary" size="sm" pendingLabel="Проверяем…">
        Проверить подключение
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
        Стадии воронки ещё не загружены. Сохраните подключение и запустите проверку, либо добавьте сопоставления
        через API.
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
              <th className="py-2 pr-4 font-medium">Воронка Битрикса</th>
              <th className="py-2 pr-4 font-medium">Стадия Битрикса</th>
              <th className="py-2 font-medium">Этап в CaseFlow</th>
            </tr>
          </thead>
          <tbody>
            {connection.mappings.map((mapping) => (
              <tr key={mapping.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-3 pr-4 text-[var(--color-ink-muted)]">
                  {mapping.pipelineName ?? `Воронка ${mapping.pipelineId}`}
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
                    <option value="">Не менять этап</option>
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
        <SubmitButton pendingLabel="Сохраняем…">Сохранить сопоставление</SubmitButton>
        {state.message ? (
          <p className={state.ok ? 'text-sm text-[var(--color-success)]' : 'text-sm text-[var(--color-danger)]'}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
