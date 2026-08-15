import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Clock, FileCheck2, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { DeadlineBadge } from '@/components/ui/status';
import { api } from '@/lib/api';
import { requireStaff } from '@/lib/session';
import type { DashboardData } from '@/lib/types';
import { formatBytes, formatRelative } from '@/lib/utils';

export const metadata: Metadata = { title: 'Рабочий стол' };

export default async function DashboardPage() {
  const profile = await requireStaff();
  const data = await api<DashboardData>('/dashboard');

  const firstName = profile.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Здравствуйте, ${firstName}`}
        description="Что требует вашего решения сегодня — по срочности."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Дел в работе" value={data.metrics.activeCases} icon={<Inbox className="h-4 w-4" />} />
        <Metric label="Мои дела" value={data.metrics.myCases} icon={<FileCheck2 className="h-4 w-4" />} />
        <Metric
          label="Документов на проверку"
          value={data.metrics.documentsForReview}
          icon={<FileCheck2 className="h-4 w-4" />}
          tone={data.metrics.documentsForReview > 0 ? 'accent' : 'neutral'}
        />
        <Metric
          label="Просроченных запросов"
          value={data.metrics.overdueRequests}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={data.metrics.overdueRequests > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Дела, требующие внимания</CardTitle>
              <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                Просроченные запросы, документы на проверке или неделя без движения.
              </p>
            </div>
            <Link href="/cases" className="text-sm font-medium text-[var(--color-accent)]">
              Все дела
            </Link>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.needsAttention.length === 0 ? (
              <EmptyState title="Всё идёт по плану" description="Ни одно дело сейчас не ждёт действий команды." />
            ) : (
              <ul>
                {data.needsAttention.map((item) => (
                  <li key={item.id} className="border-t border-[var(--color-border)]">
                    <Link
                      href={`/cases/${item.id}`}
                      className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                          {item.client.firstName} {item.client.lastName}
                          {item.currentStage ? ` · ${item.currentStage.name}` : ''}
                          {` · активность ${formatRelative(item.lastActivityAt)}`}
                        </p>
                      </div>
                      <div className="w-32 shrink-0">
                        <Progress value={item.progress} showLabel />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Документы на проверке</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.documentsForReview.length === 0 ? (
              <EmptyState title="Очередь проверки пуста" />
            ) : (
              <ul>
                {data.documentsForReview.slice(0, 6).map((document) => (
                  <li key={document.id} className="border-t border-[var(--color-border)]">
                    <Link
                      href={`/cases/${document.case.id}?tab=documents`}
                      className="block px-6 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <p className="truncate text-sm font-medium">{document.requirement?.name ?? document.filename}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                        {document.case.client.firstName} {document.case.client.lastName} ·{' '}
                        {formatRelative(document.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Просроченные запросы</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.overdueRequests.length === 0 ? (
              <EmptyState title="Просрочек нет" />
            ) : (
              <ul>
                {data.overdueRequests.slice(0, 6).map((request) => (
                  <li key={request.id} className="border-t border-[var(--color-border)]">
                    <Link
                      href={`/cases/${request.caseId}?tab=requests`}
                      className="block px-6 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{request.title}</p>
                        <DeadlineBadge deadline={request.deadline} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                        {request.client ? `${request.client.firstName} ${request.client.lastName} · ` : ''}
                        {request.case?.title}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сроки в ближайшие 48 часов</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.deadlines.length === 0 ? (
              <EmptyState title="На два дня вперёд сроков нет" />
            ) : (
              <ul>
                {data.deadlines.slice(0, 6).map((deadline) => (
                  <li key={`${deadline.kind}-${deadline.id}`} className="border-t border-[var(--color-border)]">
                    <Link
                      href={`/cases/${deadline.caseId}?tab=${deadline.kind === 'DOCUMENT' ? 'documents' : 'requests'}`}
                      className="block px-6 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{deadline.title}</p>
                        <DeadlineBadge deadline={deadline.deadline} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                        {deadline.clientName ? `${deadline.clientName} · ` : ''}
                        {deadline.caseTitle}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Без движения 7+ дней</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.staleCases.length === 0 ? (
              <EmptyState title="За неделю сдвинулись все дела" />
            ) : (
              <ul>
                {data.staleCases.slice(0, 6).map((item) => (
                  <li key={item.id} className="border-t border-[var(--color-border)]">
                    <Link
                      href={`/cases/${item.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                          {item.assignedUser?.name ?? 'Без ответственного'}
                        </p>
                      </div>
                      <Badge tone="warning">
                        <Clock className="h-3 w-3" />
                        {formatRelative(item.lastActivityAt)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последние загрузки</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {data.recentUploads.length === 0 ? (
              <EmptyState title="Загрузок пока нет" />
            ) : (
              <ul>
                {data.recentUploads.slice(0, 6).map((document) => (
                  <li key={document.id} className="border-t border-[var(--color-border)]">
                    <Link
                      href={`/cases/${document.case.id}?tab=documents`}
                      className="block px-6 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <p className="truncate text-sm font-medium">{document.filename}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                        {document.case.client.firstName} {document.case.client.lastName} ·{' '}
                        {formatBytes(document.fileSize)} · {formatRelative(document.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'danger';
}) {
  const toneClass = {
    neutral: 'text-[var(--color-ink-subtle)]',
    accent: 'text-[var(--color-accent)]',
    danger: 'text-[var(--color-danger)]',
  }[tone];

  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-ink-muted)]">{label}</p>
        <span className={toneClass}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    </Card>
  );
}
