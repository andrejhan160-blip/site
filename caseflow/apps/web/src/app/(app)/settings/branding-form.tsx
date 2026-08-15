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
        <Field label="Название компании">
          <Input name="name" defaultValue={organization.name} required />
        </Field>
        <Field label="Почта поддержки" hint="Показывается клиентам внизу кабинета.">
          <Input name="supportEmail" type="email" defaultValue={organization.supportEmail ?? ''} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ссылка на логотип" hint="Лучше всего — квадратная картинка.">
          <Input name="logoUrl" type="url" defaultValue={organization.logoUrl ?? ''} placeholder="https://…" />
        </Field>
        <Field label="Основной цвет" hint="Используется в обоих приложениях и в письмах.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="primaryColor"
              defaultValue={organization.primaryColor}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--color-border-strong)] bg-transparent p-1"
              aria-label="Основной цвет"
            />
            <span className="text-sm text-[var(--color-ink-muted)]">{organization.primaryColor}</span>
          </div>
        </Field>
      </div>

      <Field label="Приветствие в кабинете" hint="Первое, что клиент читает после входа.">
        <Textarea name="portalWelcomeText" rows={3} defaultValue={organization.portalWelcomeText ?? ''} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Часовой пояс" hint="По нему считаются сроки и время событий.">
          <Input name="timezone" defaultValue={organization.timezone} />
        </Field>
        <Field
          label="Свой домен"
          hint="Сохраняется уже сейчас, маршрутизация появится позже. Например: portal.company.ru"
        >
          <Input name="customDomain" defaultValue={organization.customDomain ?? ''} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Сохраняем…">Сохранить оформление</SubmitButton>
        {state.message ? (
          <p className={state.ok ? 'text-sm text-[var(--color-success)]' : 'text-sm text-[var(--color-danger)]'}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
