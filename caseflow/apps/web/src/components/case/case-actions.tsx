'use client';

import { FilePlus2, GitBranch, ListPlus, MessageSquarePlus, Settings2 } from 'lucide-react';
import { FormDialog } from '@/components/forms/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { changeStage, createRequest, createTask, requestDocument, updateCase } from '@/lib/actions';
import { REQUEST_TYPE_LABELS, TASK_VISIBILITY_LABELS } from '@/lib/i18n';
import type { CaseStatus, Stage, TeamMember } from '@/lib/types';

export function ChangeStageDialog({
  caseId,
  stages,
  currentStageId,
}: {
  caseId: string;
  stages: Stage[];
  currentStageId: string | null;
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <GitBranch />
          Сменить этап
        </Button>
      }
      title="Смена этапа"
      description="Предыдущие этапы отмечаются завершёнными, клиент получает уведомление о новом."
      action={changeStage}
      submitLabel="Перевести дело"
      pendingLabel="Переводим…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Перевести на этап">
        <Select name="stageId" required defaultValue={currentStageId ?? ''}>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.position + 1}. {stage.name}
              {stage.id === currentStageId ? ' (текущий)' : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Внутренняя заметка" hint="Попадёт в историю дела; клиент её не увидит.">
        <Textarea name="note" rows={2} />
      </Field>
    </FormDialog>
  );
}

export function RequestDocumentDialog({ caseId, stages }: { caseId: string; stages: Stage[] }) {
  return (
    <FormDialog
      trigger={
        <Button>
          <FilePlus2 />
          Запросить документ
        </Button>
      }
      title="Запрос документа"
      description="Создаёт требование и запрос клиенту, отправляет уведомление."
      action={requestDocument}
      submitLabel="Отправить запрос"
      pendingLabel="Отправляем…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Документ">
        <Input name="name" required autoFocus placeholder="Например: полис медицинского страхования" />
      </Field>
      <Field label="Этап">
        <Select name="stageId" defaultValue="">
          <option value="">Текущий этап</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.position + 1}. {stage.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Инструкция" hint="Что именно загрузить — клиент увидит этот текст дословно.">
        <Textarea
          name="instructions"
          rows={3}
          placeholder="Цветной скан, все страницы, выдан не более 3 месяцев назад."
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Срок">
          <Input name="deadline" type="date" />
        </Field>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="required" defaultChecked className="h-4 w-4 rounded" />
            Обязательный документ
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notifyClient" defaultChecked className="h-4 w-4 rounded" />
            Уведомить клиента
          </label>
        </div>
      </div>
    </FormDialog>
  );
}

export function CreateRequestDialog({ caseId }: { caseId: string }) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <MessageSquarePlus />
          Новый запрос
        </Button>
      }
      title="Запрос клиенту"
      description="Для информации, подтверждений и действий, которые не являются документом."
      action={createRequest}
      submitLabel="Отправить запрос"
      pendingLabel="Отправляем…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Заголовок">
        <Input name="title" required autoFocus placeholder="Например: подтвердите даты поездки" />
      </Field>
      <Field label="Тип">
        <Select name="type" defaultValue="INFORMATION">
          <option value="INFORMATION">{REQUEST_TYPE_LABELS.INFORMATION}</option>
          <option value="ACTION">{REQUEST_TYPE_LABELS.ACTION}</option>
          <option value="APPOINTMENT">{REQUEST_TYPE_LABELS.APPOINTMENT}</option>
          <option value="PAYMENT_CONFIRMATION">{REQUEST_TYPE_LABELS.PAYMENT_CONFIRMATION}</option>
        </Select>
      </Field>
      <Field label="Описание">
        <Textarea name="description" rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Срок">
          <Input name="deadline" type="date" />
        </Field>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="notifyClient" defaultChecked className="h-4 w-4 rounded" />
          Уведомить клиента
        </label>
      </div>
    </FormDialog>
  );
}

export function CreateTaskDialog({ caseId, team }: { caseId: string; team: TeamMember[] }) {
  return (
    <FormDialog
      trigger={
        <Button variant="secondary">
          <ListPlus />
          Новая задача
        </Button>
      }
      title="Новая задача"
      description="Внутренние задачи видит только команда. Клиентские появляются в его кабинете."
      action={createTask}
      submitLabel="Создать задачу"
      pendingLabel="Создаём…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Заголовок">
        <Input name="title" required autoFocus />
      </Field>
      <Field label="Описание">
        <Textarea name="description" rows={3} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Исполнитель">
          <Select name="assignedToId" defaultValue="">
            <option value="">Я</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Срок">
          <Input name="deadline" type="date" />
        </Field>
      </div>
      <Field label="Кому видно">
        <Select name="visibility" defaultValue="INTERNAL">
          <option value="INTERNAL">{TASK_VISIBILITY_LABELS.INTERNAL}</option>
          <option value="CLIENT">{TASK_VISIBILITY_LABELS.CLIENT}</option>
          <option value="BOTH">{TASK_VISIBILITY_LABELS.BOTH}</option>
        </Select>
      </Field>
    </FormDialog>
  );
}

export function CaseSettingsDialog({
  caseId,
  title,
  status,
  assignedUserId,
  team,
}: {
  caseId: string;
  title: string;
  status: CaseStatus;
  assignedUserId: string | null;
  team: TeamMember[];
}) {
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label="Настройки дела">
          <Settings2 />
        </Button>
      }
      title="Настройки дела"
      description="Переименовать, сменить ответственного или приостановить дело."
      action={updateCase}
      submitLabel="Сохранить"
      pendingLabel="Сохраняем…"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Название дела">
        <Input name="title" defaultValue={title} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ответственный">
          <Select name="assignedUserId" defaultValue={assignedUserId ?? ''}>
            <option value="">Не менять</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select name="status" defaultValue={status}>
            <option value="ACTIVE">В работе</option>
            <option value="ON_HOLD">Приостановлено</option>
            <option value="COMPLETED">Завершено</option>
            <option value="CANCELLED">Отменено</option>
          </Select>
        </Field>
      </div>
    </FormDialog>
  );
}
