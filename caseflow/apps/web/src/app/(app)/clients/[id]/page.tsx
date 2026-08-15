import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ActivityFeed } from '@/components/case/activity-feed';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { CaseStatusBadge } from '@/components/ui/status';
import { api, ApiError } from '@/lib/api';
import { requireStaff } from '@/lib/session';
import type { ClientDetail } from '@/lib/types';
import { formatDate, formatRelative } from '@/lib/utils';

export const metadata: Metadata = { title: 'Клиент' };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  let client: ClientDetail;
  try {
    client = await api<ClientDetail>(`/clients/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <>
      <PageHeader title={fullName} description={client.email} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Данные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={fullName} size="lg" />
              <div>
                <p className="font-medium">{fullName}</p>
                <p className="text-sm text-[var(--color-ink-muted)]">Клиент с {formatDate(client.createdAt)}</p>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <Detail label="Почта" value={client.email} />
              <Detail label="Телефон" value={client.phone ?? '—'} />
              <Detail label="Telegram" value={client.telegramId ?? '—'} />
              <Detail label="Контакт в CRM" value={client.externalCrmContactId ?? '—'} />
              <Detail
                label="Доступ в кабинет"
                value={
                  client.portalUser
                    ? client.portalUser.lastLoginAt
                      ? `Активен · вход ${formatRelative(client.portalUser.lastLoginAt)}`
                      : 'Приглашён · ещё не входил'
                    : 'Кабинета нет'
                }
              />
            </dl>
            {client.notes ? (
              <div className="rounded-lg bg-[var(--color-surface-muted)] px-3 py-2.5 text-sm text-[var(--color-ink-muted)]">
                {client.notes}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Дела в работе</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {client.activeCases.length === 0 ? (
                <EmptyState title="Дел в работе нет" description="У этого клиента сейчас ничего не идёт." />
              ) : (
                <CaseList cases={client.activeCases} />
              )}
            </CardContent>
          </Card>

          {client.completedCases.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Завершённые дела</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <CaseList cases={client.completedCases} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Последние события</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed events={client.recentActivity} showCase />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function CaseList({ cases }: { cases: ClientDetail['activeCases'] }) {
  return (
    <ul>
      {cases.map((item) => (
        <li key={item.id} className="border-t border-[var(--color-border)]">
          <Link
            href={`/cases/${item.id}`}
            className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                {item.currentStage?.name ?? 'Без этапа'} · {item.assignedUser?.name ?? 'Без ответственного'}
              </p>
            </div>
            <CaseStatusBadge status={item.status} />
            <div className="w-28">
              <Progress value={item.progress} showLabel />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
