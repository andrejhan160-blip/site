import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ActivityFeed } from '@/components/case/activity-feed';
import { StageTimeline } from '@/components/case/stage-timeline';
import { TaskToggle } from '@/components/case/task-toggle';
import { UploadForm } from '@/components/case/upload-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { DeadlineBadge, RequestStatusBadge } from '@/components/ui/status';
import { api } from '@/lib/api';
import { requireClient } from '@/lib/session';
import type { PortalDashboard } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { CompleteRequestButton } from './complete-request-button';

export const metadata: Metadata = { title: 'Your case' };

export default async function PortalHome() {
  await requireClient();
  const data = await api<PortalDashboard>('/portal');

  const activeCase = data.activeCase;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {data.client.firstName}
        </h1>
        {data.organization.portalWelcomeText ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-muted)] text-balance">
            {data.organization.portalWelcomeText}
          </p>
        ) : null}
      </section>

      {activeCase ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">
                  Your application
                </p>
                <h2 className="mt-1 text-lg font-semibold">{activeCase.title}</h2>
              </div>
              <Link
                href={`/portal/cases/${activeCase.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)]"
              >
                Full timeline
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5">
              <Progress value={activeCase.progress} showLabel />
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">Current stage</dt>
                <dd className="mt-1 font-medium">{activeCase.currentStage?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">Next stage</dt>
                <dd className="mt-1 font-medium text-[var(--color-ink-muted)]">{data.nextStage?.name ?? 'Final stage'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">Your case manager</dt>
                <dd className="mt-1 font-medium">{activeCase.assignedUser?.name ?? '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <EmptyState title="No case yet" description="Your case will appear here as soon as it is opened." />
        </Card>
      )}

      {data.openRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Waiting on you</CardTitle>
            <span className="text-sm text-[var(--color-ink-muted)]">{data.openRequests.length} open</span>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <ul>
              {data.openRequests.map((request) => (
                <li key={request.id} className="border-t border-[var(--color-border)] px-6 py-4">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{request.title}</p>
                      {request.description ? (
                        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{request.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <DeadlineBadge deadline={request.deadline} />
                        <RequestStatusBadge status={request.status} />
                      </div>
                    </div>

                    {request.requirement ? (
                      <UploadForm caseId={request.caseId} requirementId={request.requirement.id} portal label="Upload" />
                    ) : (
                      <CompleteRequestButton requestId={request.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data.tasks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Things to prepare</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <ul>
              {data.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-t border-[var(--color-border)] px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{task.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <DeadlineBadge deadline={task.deadline} />
                    <TaskToggle taskId={task.id} status={task.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data.deadlines.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <ul>
              {data.deadlines.map((requirement) => (
                <li
                  key={requirement.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{requirement.name}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {requirement.deadline ? `Due ${formatDate(requirement.deadline)}` : ''}
                    </p>
                  </div>
                  <DeadlineBadge deadline={requirement.deadline} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {activeCase ? (
        <Card>
          <CardHeader>
            <CardTitle>Where your case stands</CardTitle>
          </CardHeader>
          <CardContent>
            <StageTimeline stages={activeCase.stages} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Latest activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed events={data.activity} emptyLabel="Nothing has happened on your case yet." />
        </CardContent>
      </Card>
    </div>
  );
}
