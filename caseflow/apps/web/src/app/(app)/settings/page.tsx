import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { canAdminister, requireStaff } from '@/lib/session';
import type { Organization } from '@/lib/types';
import { BrandingForm } from './branding-form';
import { SettingsNav } from './settings-nav';

export const metadata: Metadata = { title: 'Настройки' };

export default async function SettingsPage() {
  const profile = await requireStaff();
  const organization = await api<Organization>('/organization');

  return (
    <>
      <PageHeader title="Настройки" description="Как ваша компания выглядит для клиентов." />
      <SettingsNav />

      <Card className="max-w-3xl">
        <CardHeader>
          <div>
            <CardTitle>Оформление</CardTitle>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Применяется в кабинете клиента, в приложении сотрудника и в письмах.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {canAdminister(profile.role) ? (
            <BrandingForm organization={organization} />
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">
              Менять оформление могут владелец и администратор. Если нужно что-то поправить — обратитесь к администратору.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
