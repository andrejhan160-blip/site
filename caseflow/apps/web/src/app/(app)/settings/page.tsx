import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { canAdminister, requireStaff } from '@/lib/session';
import type { Organization } from '@/lib/types';
import { BrandingForm } from './branding-form';
import { SettingsNav } from './settings-nav';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await requireStaff();
  const organization = await api<Organization>('/organization');

  return (
    <>
      <PageHeader title="Settings" description="How your company appears to clients." />
      <SettingsNav />

      <Card className="max-w-3xl">
        <CardHeader>
          <div>
            <CardTitle>Branding</CardTitle>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Applied to the client portal, the employee app and outbound email.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {canAdminister(profile.role) ? (
            <BrandingForm organization={organization} />
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">
              Only owners and admins can change branding. Ask an admin if something here needs updating.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
