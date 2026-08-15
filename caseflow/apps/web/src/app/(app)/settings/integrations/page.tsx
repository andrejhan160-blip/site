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

export const metadata: Metadata = { title: 'Интеграции' };

export default async function IntegrationsPage() {
  const profile = await requireStaff();

  if (!canAdminister(profile.role)) {
    return (
      <>
        <PageHeader title="Настройки" />
        <SettingsNav />
        <Card className="max-w-3xl px-6 py-8">
          <p className="text-sm text-[var(--color-ink-muted)]">
            Интеграциями управляют владелец и администратор.
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
        title="Настройки"
        description="CaseFlow работает сам по себе. Интеграция нужна только тем, кто ведёт сделки в CRM."
      />
      <SettingsNav />

      <div className="max-w-4xl space-y-5">
        {!bitrix?.isActive ? (
          <Card className="border-dashed px-6 py-5">
            <p className="text-sm font-medium">CRM подключать не обязательно</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              Дела, этапы, документы, сроки, задачи, переписка и кабинет клиента живут в CaseFlow и работают
              без всякой интеграции. Подключение нужно в одном случае: вы уже ведёте сделки в CRM и хотите,
              чтобы смена стадии там сама переводила дело на нужный этап здесь. Даже тогда CaseFlow остаётся
              источником правды для кабинета, документов и истории — из CRM читаются только те поля, которые
              вы сопоставите.
            </p>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bitrix24</CardTitle>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                Смена стадии сделки приходит в CaseFlow; документы и история для клиента остаются здесь.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {bitrix?.isActive ? <Badge tone="success">Подключено</Badge> : <Badge tone="neutral">Не подключено</Badge>}
              {bitrix?.lastSyncedAt ? (
                <span className="text-xs text-[var(--color-ink-subtle)]">
                  синхронизация {formatRelative(bitrix.lastSyncedAt)}
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
                  <CardTitle>Исходящий вебхук</CardTitle>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    В Битрикс24 создайте исходящий вебхук на событие <code>ONCRMDEALUPDATE</code> с этим адресом,
                    а токен ниже укажите как токен приложения.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Адрес обработчика" value={webhookUrl} />
                <Row label="Токен приложения" value={bitrix.webhookSecret ?? '—'} />
                <p className="text-xs text-[var(--color-ink-subtle)]">
                  По токену определяется ваша организация при каждой доставке. Повторные доставки одного события
                  записываются один раз, поэтому ретраи Битрикса не задваивают историю и уведомления.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Сопоставление стадий</CardTitle>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    Укажите, на какой этап CaseFlow переводить дело при каждой стадии воронки Битрикса.
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
