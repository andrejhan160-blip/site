import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { canAdminister, requireStaff } from '@/lib/session';
import type { CrmSettings, WorkflowTemplateDetail, WorkflowTemplateSummary } from '@/lib/types';
import { formatRelative } from '@/lib/utils';
import { SettingsNav } from '../settings-nav';
import { ConnectionForm, StageMappingForm, TestConnectionButton } from './integration-forms';

export const metadata: Metadata = { title: 'Integrations' };

export default async function IntegrationsPage() {
  const profile = await requireStaff();

  if (!canAdminister(profile.role)) {
    return (
      <>
        <PageHeader title="Settings" />
        <SettingsNav />
        <Card className="max-w-3xl px-6 py-8">
          <p className="text-sm text-[var(--color-ink-muted)]">
            Integrations are managed by owners and admins.
          </p>
        </Card>
      </>
    );
  }

  const [settings, summaries] = await Promise.all([
    api<CrmSettings>('/integrations/crm'),
    api<WorkflowTemplateSummary[]>('/workflow-templates'),
  ]);

  const templates = await Promise.all(
    summaries.map((summary) => api<WorkflowTemplateDetail>(`/workflow-templates/${summary.id}`)),
  );

  const bitrix = settings.connections.find((connection) => connection.provider === 'BITRIX24');
  const webhookUrl = `${process.env.API_URL ?? 'http://localhost:4000/api'}/integrations/bitrix24/webhook`;

  return (
    <>
      <PageHeader
        title="Settings"
        description="CaseFlow stays the source of truth for the portal, documents and history. Only the fields you map are read from the CRM."
      />
      <SettingsNav />

      <div className="max-w-4xl space-y-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bitrix24</CardTitle>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                Deal stage changes flow into CaseFlow; documents and client-facing history stay here.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {bitrix?.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Not connected</Badge>}
              {bitrix?.lastSyncedAt ? (
                <span className="text-xs text-[var(--color-ink-subtle)]">
                  synced {formatRelative(bitrix.lastSyncedAt)}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ConnectionForm connection={bitrix} />
            {bitrix ? <TestConnectionButton connectionId={bitrix.id} /> : null}
          </CardContent>
        </Card>

        {bitrix ? (
          <>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Outbound webhook</CardTitle>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    In Bitrix24 create an outbound webhook for <code>ONCRMDEALUPDATE</code> pointing at this URL, and
                    use the token below as the application token.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Handler URL" value={webhookUrl} />
                <Row label="Application token" value={bitrix.webhookSecret ?? '—'} />
                <p className="text-xs text-[var(--color-ink-subtle)]">
                  The token identifies your organization on every delivery. Repeated deliveries of the same event are
                  recorded once, so a Bitrix retry never duplicates activity or notifications.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Stage mapping</CardTitle>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    Map each Bitrix pipeline stage to the CaseFlow stage a case should move to.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <StageMappingForm connection={bitrix} templates={templates} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3.5 py-2.5">
      <span className="text-sm text-[var(--color-ink-muted)]">{label}</span>
      <code className="break-all text-[13px] font-medium">{value}</code>
    </div>
  );
}
