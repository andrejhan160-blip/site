import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StageTimeline } from '@/components/case/stage-timeline';
import { ActivityFeed } from '@/components/case/activity-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api, ApiError } from '@/lib/api';
import { requireClient } from '@/lib/session';
import type { CaseDetail } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Ваше дело' };

export default async function PortalCasePage({ params }: { params: Promise<{ id: string }> }) {
  await requireClient();
  const { id } = await params;

  let record: CaseDetail;
  try {
    record = await api<CaseDetail>(`/portal/cases/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal" className="text-sm text-[var(--color-ink-muted)]">
          ← Обзор
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{record.title}</h1>
        {record.description ? (
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">{record.description}</p>
        ) : null}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Progress value={record.progress} showLabel />
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">Текущий этап</dt>
              <dd className="mt-1 font-medium">{record.currentStage?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">Открыто</dt>
              <dd className="mt-1 font-medium">{formatDate(record.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">Ваш специалист</dt>
              <dd className="mt-1 font-medium">{record.assignedUser?.name ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Этапы вашего дела</CardTitle>
        </CardHeader>
        <CardContent>
          <StageTimeline stages={record.stages} showRequirements />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed events={record.activity} />
        </CardContent>
      </Card>
    </div>
  );
}
