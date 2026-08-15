'use client';

import { Plus } from 'lucide-react';
import { FormDialog } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { createCase } from '@/lib/actions';
import { countOf } from '@/lib/i18n';
import type { ClientListRow, TeamMember, WorkflowTemplateSummary } from '@/lib/types';

export function NewCaseDialog({
  clients,
  templates,
  team,
  crmConnected = false,
}: {
  clients: ClientListRow[];
  templates: WorkflowTemplateSummary[];
  team: TeamMember[];
  /** Без подключённой CRM поле сделки не показывается: оно ни о чём не говорит. */
  crmConnected?: boolean;
}) {
  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          Новое дело
        </Button>
      }
      title="Новое дело"
      description="Воркфлоу копируется в дело. Правки шаблона это дело уже не затронут."
      action={createCase}
      submitLabel="Открыть дело"
      pendingLabel="Открываем…"
    >
      <Field label="Клиент">
        <Select name="clientId" required defaultValue="">
          <option value="" disabled>
            Выберите клиента
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.firstName} {client.lastName} — {client.email}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Воркфлоу">
        <Select name="workflowTemplateId" required defaultValue="">
          <option value="" disabled>
            Выберите воркфлоу
          </option>
          {templates
            .filter((template) => template.isActive)
            .map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({countOf(template.stages.length, 'этап', 'этапа', 'этапов')})
              </option>
            ))}
        </Select>
      </Field>

      <Field label="Название дела" hint="По умолчанию — название воркфлоу.">
        <Input name="title" placeholder="Например: ВНЖ Франции — Иван Петров" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ответственный">
          <Select name="assignedUserId" defaultValue="">
            <option value="">Я</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        {crmConnected ? (
          <Field label="ID сделки в CRM" hint="Свяжет дело со сделкой в Битрикс24.">
            <Input name="externalCrmEntityId" />
          </Field>
        ) : null}
      </div>

      <Field label="Описание">
        <Textarea name="description" rows={3} />
      </Field>
    </FormDialog>
  );
}
