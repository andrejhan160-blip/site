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
          Новый клиент
        </Button>
      }
      title="Новый клиент"
      description="Доступ в кабинет придёт на почту — пароль задавать не нужно."
      action={createClient}
      submitLabel="Создать клиента"
      pendingLabel="Создаём…"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Имя">
          <Input name="firstName" required autoFocus />
        </Field>
        <Field label="Фамилия">
          <Input name="lastName" required />
        </Field>
      </div>
      <Field label="Почта">
        <Input name="email" type="email" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Телефон">
          <Input name="phone" />
        </Field>
        <Field label="ID контакта в CRM" hint="Не обязательно — связывает с контактом в Битрикс24.">
          <Input name="externalCrmContactId" />
        </Field>
      </div>
      <Field label="Заметки">
        <Textarea name="notes" rows={3} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createPortalAccess" defaultChecked className="h-4 w-4 rounded" />
        Создать кабинет для этого клиента
      </label>
    </FormDialog>
  );
}
