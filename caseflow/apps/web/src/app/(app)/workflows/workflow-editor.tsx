'use client';

import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { saveWorkflowTemplate } from '@/lib/actions';
import type { WorkflowTemplateDetail } from '@/lib/types';

interface DraftRequirement {
  key: string;
  name: string;
  instructions: string;
  required: boolean;
  deadlineDays: string;
}

interface DraftStage {
  key: string;
  name: string;
  description: string;
  requirements: DraftRequirement[];
}

let counter = 0;
const nextKey = () => `k${(counter += 1)}`;

const emptyRequirement = (): DraftRequirement => ({
  key: nextKey(),
  name: '',
  instructions: '',
  required: true,
  deadlineDays: '',
});

const emptyStage = (): DraftStage => ({ key: nextKey(), name: '', description: '', requirements: [] });

function toDraft(template: WorkflowTemplateDetail): DraftStage[] {
  return template.stages.map((stage) => ({
    key: nextKey(),
    name: stage.name,
    description: stage.description ?? '',
    requirements: stage.requirements.map((requirement) => ({
      key: nextKey(),
      name: requirement.name,
      instructions: requirement.instructions ?? '',
      required: requirement.required,
      deadlineDays: requirement.deadlineDays === null ? '' : String(requirement.deadlineDays),
    })),
  }));
}

/**
 * Builder for a reusable workflow. Stages and their document requirements are
 * edited client-side and submitted as one payload, so a half-saved workflow
 * cannot exist.
 */
export function WorkflowEditor({ template }: { template?: WorkflowTemplateDetail }) {
  const [state, formAction] = useActionState(saveWorkflowTemplate, idleState);
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [stages, setStages] = useState<DraftStage[]>(template ? toDraft(template) : [emptyStage()]);

  const updateStage = (key: string, patch: Partial<DraftStage>) =>
    setStages((current) => current.map((stage) => (stage.key === key ? { ...stage, ...patch } : stage)));

  const updateRequirement = (stageKey: string, requirementKey: string, patch: Partial<DraftRequirement>) =>
    setStages((current) =>
      current.map((stage) =>
        stage.key === stageKey
          ? {
              ...stage,
              requirements: stage.requirements.map((requirement) =>
                requirement.key === requirementKey ? { ...requirement, ...patch } : requirement,
              ),
            }
          : stage,
      ),
    );

  const move = (index: number, direction: -1 | 1) =>
    setStages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const payload = JSON.stringify({
    name: name.trim(),
    description: description.trim() || undefined,
    isActive,
    stages: stages.map((stage) => ({
      name: stage.name.trim(),
      description: stage.description.trim() || undefined,
      requirements: stage.requirements.map((requirement) => ({
        name: requirement.name.trim(),
        instructions: requirement.instructions.trim() || undefined,
        required: requirement.required,
        deadlineDays: requirement.deadlineDays === '' ? null : Number(requirement.deadlineDays),
      })),
    })),
  });

  return (
    <form action={formAction} className="max-w-4xl space-y-5">
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
      <input type="hidden" name="template" value={payload} />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Field label="Название воркфлоу">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Например: ВНЖ Франции"
            />
          </Field>
          <Field label="Описание">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Одним предложением: что это за процесс."
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded"
            />
            Доступен при открытии нового дела
          </label>
        </CardContent>
      </Card>

      {stages.map((stage, index) => (
        <Card key={stage.key}>
          <CardHeader className="items-center">
            <div className="flex flex-1 items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-sm font-semibold text-[var(--color-ink-muted)]">
                {index + 1}
              </span>
              <Input
                value={stage.name}
                onChange={(event) => updateStage(stage.key, { name: event.target.value })}
                placeholder="Название этапа"
                required
                className="max-w-sm"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Поднять этап"
              >
                <GripVertical className="rotate-180" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => move(index, 1)}
                disabled={index === stages.length - 1}
                aria-label="Опустить этап"
              >
                <GripVertical />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setStages((current) => current.filter((item) => item.key !== stage.key))}
                disabled={stages.length === 1}
                aria-label="Удалить этап"
              >
                <Trash2 />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea
              value={stage.description}
              onChange={(event) => updateStage(stage.key, { description: event.target.value })}
              rows={2}
              placeholder="Что происходит на этом этапе — текст видит клиент."
            />

            {stage.requirements.length > 0 ? (
              <ul className="space-y-3">
                {stage.requirements.map((requirement) => (
                  <li key={requirement.key} className="rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <Input
                          value={requirement.name}
                          onChange={(event) =>
                            updateRequirement(stage.key, requirement.key, { name: event.target.value })
                          }
                          placeholder="Название документа"
                          required
                        />
                        <Textarea
                          value={requirement.instructions}
                          onChange={(event) =>
                            updateRequirement(stage.key, requirement.key, { instructions: event.target.value })
                          }
                          rows={2}
                          placeholder="Инструкция, которую клиент увидит дословно."
                        />
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={requirement.required}
                              onChange={(event) =>
                                updateRequirement(stage.key, requirement.key, { required: event.target.checked })
                              }
                              className="h-4 w-4 rounded"
                            />
                            Обязательный
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                            Срок
                            <Input
                              type="number"
                              min={0}
                              value={requirement.deadlineDays}
                              onChange={(event) =>
                                updateRequirement(stage.key, requirement.key, { deadlineDays: event.target.value })
                              }
                              placeholder="—"
                              className="h-9 w-20"
                            />
                            дн. после открытия дела
                          </label>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          updateStage(stage.key, {
                            requirements: stage.requirements.filter((item) => item.key !== requirement.key),
                          })
                        }
                        aria-label="Удалить документ"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                updateStage(stage.key, { requirements: [...stage.requirements, emptyRequirement()] })
              }
            >
              <Plus />
              Добавить документ
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setStages((current) => [...current, emptyStage()])}
      >
        <Plus />
        Добавить этап
      </Button>

      {!state.ok && state.message ? (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-5">
        <SubmitButton pendingLabel="Сохраняем…">
          {template ? 'Сохранить воркфлоу' : 'Создать воркфлоу'}
        </SubmitButton>
        <p className="text-sm text-[var(--color-ink-muted)]">
          У уже открытых дел своя копия — сохранение их не затрагивает.
        </p>
      </div>
    </form>
  );
}
