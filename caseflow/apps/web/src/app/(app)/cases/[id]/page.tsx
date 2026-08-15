import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  CaseSettingsDialog,
  ChangeStageDialog,
  CreateRequestDialog,
  CreateTaskDialog,
  RequestDocumentDialog,
} from '@/components/case/case-actions';
import { ActivityFeed } from '@/components/case/activity-feed';
import { DocumentList } from '@/components/case/document-list';
import { MessageThread } from '@/components/case/message-thread';
import { StageTimeline } from '@/components/case/stage-timeline';
import { TaskToggle } from '@/components/case/task-toggle';
import { UploadForm } from '@/components/case/upload-form';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import {
  CaseStatusBadge,
  DeadlineBadge,
  RequestStatusBadge,
  TaskStatusBadge,
} from '@/components/ui/status';
import { Tabs } from '@/components/ui/tabs';
import { api, ApiError } from '@/lib/api';
import { requireStaff } from '@/lib/session';
import type { CaseDetail, TeamMember } from '@/lib/types';
import { REQUEST_TYPE_LABELS, TASK_VISIBILITY_LABELS, countOf } from '@/lib/i18n';
import { formatDate, formatRelative } from '@/lib/utils';
import { CancelRequestButton } from './cancel-request-button';

export const metadata: Metadata = { title: 'Дело' };

type Tab = 'overview' | 'stages' | 'documents' | 'requests' | 'tasks' | 'messages' | 'activity';

export default async function CaseWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireStaff();
  const { id } = await params;
  const { tab } = await searchParams;

  let record: CaseDetail;
  try {
    record = await api<CaseDetail>(`/cases/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const team = await api<TeamMember[]>('/organization/users');
  const active: Tab = (tab as Tab) ?? 'overview';

  const openRequests = record.requests.filter((request) => request.status === 'OPEN' || request.status === 'OVERDUE');
  const pendingDocuments = record.requirements.filter((requirement) =>
    ['PENDING', 'REJECTED', 'UNDER_REVIEW', 'UPLOADED'].includes(requirement.status),
  );
  const openTasks = record.tasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED');

  return (
    <>
      <div className="mb-6">
        <Link href="/cases" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Все дела
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight lg:text-[28px]">{record.title}</h1>
              <CaseStatusBadge status={record.status} />
            </div>
            <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
              <Link href={`/clients/${record.client.id}`} className="font-medium text-[var(--color-ink)] hover:underline">
                {record.client.firstName} {record.client.lastName}
              </Link>
              {' · '}
              {record.client.email}
              {record.externalCrmEntityId ? ` · сделка в CRM №${record.externalCrmEntityId}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RequestDocumentDialog caseId={record.id} stages={record.stages} />
            <ChangeStageDialog caseId={record.id} stages={record.stages} currentStageId={record.currentStage?.id ?? null} />
            <CreateRequestDialog caseId={record.id} />
            <CreateTaskDialog caseId={record.id} team={team} />
            <UploadForm caseId={record.id} label="Upload" variant="secondary" size="md" />
            <CaseSettingsDialog
              caseId={record.id}
              title={record.title}
              status={record.status}
              assignedUserId={record.assignedUser?.id ?? null}
              team={team}
            />
          </div>
        </div>

        <Card className="mt-5 px-6 py-4">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Текущий этап">
              <p className="font-medium">{record.currentStage?.name ?? 'Без этапа'}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {record.currentStage
                  ? `Этап ${record.currentStage.position + 1} из ${record.stages.length}`
                  : '—'}
              </p>
            </Summary>

            <Summary label="Прогресс">
              <Progress value={record.progress} showLabel />
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                Принято {record.requirements.filter((r) => r.status === 'APPROVED').length} из{' '}
                {countOf(record.requirements.length, 'документа', 'документов', 'документов')}
              </p>
            </Summary>

            <Summary label="Ответственный">
              {record.assignedUser ? (
                <span className="flex items-center gap-2">
                  <Avatar name={record.assignedUser.name} size="sm" />
                  <span className="font-medium">{record.assignedUser.name}</span>
                </span>
              ) : (
                <span className="text-[var(--color-ink-subtle)]">Не назначен</span>
              )}
            </Summary>

            <Summary label="Воркфлоу">
              <p className="font-medium">{record.template?.name ?? 'Без шаблона'}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                Открыто {formatDate(record.createdAt)} · обновлено {formatRelative(record.lastActivityAt)}
              </p>
            </Summary>
          </div>
        </Card>
      </div>

      <Suspense>
        <Tabs
          items={[
            { key: 'overview', label: 'Обзор' },
            { key: 'stages', label: 'Этапы' },
            { key: 'documents', label: 'Документы', count: pendingDocuments.length },
            { key: 'requests', label: 'Запросы', count: openRequests.length },
            { key: 'tasks', label: 'Задачи', count: openTasks.length },
            { key: 'messages', label: 'Сообщения', count: record.messages.length },
            { key: 'activity', label: 'История' },
          ]}
        />
      </Suspense>

      <div className="mt-6">
        {active === 'overview' ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Что с делом сейчас</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {record.description ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">{record.description}</p>
                ) : null}

                <div>
                  <p className="mb-3 text-sm font-medium">Ждём от клиента</p>
                  {openRequests.length === 0 && pendingDocuments.length === 0 ? (
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      Сейчас от клиента ничего не ждём.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {openRequests.map((request) => (
                        <li
                          key={request.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3.5 py-2.5"
                        >
                          <span className="text-sm">{request.title}</span>
                          <span className="flex items-center gap-2">
                            <DeadlineBadge deadline={request.deadline} />
                            <RequestStatusBadge status={request.status} />
                          </span>
                        </li>
                      ))}
                      {pendingDocuments
                        .filter((requirement) => requirement.status !== 'UNDER_REVIEW')
                        .map((requirement) => (
                          <li
                            key={requirement.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3.5 py-2.5"
                          >
                            <span className="text-sm">{requirement.name}</span>
                            <span className="flex items-center gap-2">
                              <DeadlineBadge deadline={requirement.deadline} />
                              <Badge tone={requirement.status === 'REJECTED' ? 'danger' : 'warning'}>
                                {requirement.status === 'REJECTED' ? 'Отклонён' : 'Не загружен'}
                              </Badge>
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium">На стороне команды</p>
                  {record.requirements.filter((requirement) => requirement.status === 'UNDER_REVIEW').length === 0 &&
                  openTasks.length === 0 ? (
                    <p className="text-sm text-[var(--color-ink-muted)]">По этому делу задач в очереди нет.</p>
                  ) : (
                    <ul className="space-y-2">
                      {record.requirements
                        .filter((requirement) => requirement.status === 'UNDER_REVIEW')
                        .map((requirement) => (
                          <li
                            key={requirement.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3.5 py-2.5"
                          >
                            <span className="text-sm">{requirement.name}</span>
                            <Badge tone="info">Ждёт проверки</Badge>
                          </li>
                        ))}
                      {openTasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3.5 py-2.5"
                        >
                          <span className="text-sm">{task.title}</span>
                          <span className="flex items-center gap-2">
                            <DeadlineBadge deadline={task.deadline} />
                            <TaskStatusBadge status={task.status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Этапы</CardTitle>
              </CardHeader>
              <CardContent>
                <StageTimeline stages={record.stages} />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {active === 'stages' ? (
          <Card>
            <CardHeader>
              <CardTitle>Этапы воркфлоу</CardTitle>
              <ChangeStageDialog
                caseId={record.id}
                stages={record.stages}
                currentStageId={record.currentStage?.id ?? null}
              />
            </CardHeader>
            <CardContent>
              <StageTimeline stages={record.stages} showRequirements />
            </CardContent>
          </Card>
        ) : null}

        {active === 'documents' ? (
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Документы</CardTitle>
              <RequestDocumentDialog caseId={record.id} stages={record.stages} />
            </CardHeader>
            <CardContent className="p-0">
              <DocumentList
                requirements={record.requirements}
                caseId={record.id}
                canReview
                canUpload
                emptyLabel="Документы пока не запрашивались."
              />
            </CardContent>
          </Card>
        ) : null}

        {active === 'requests' ? (
          <Card>
            <CardHeader>
              <CardTitle>Запросы клиенту</CardTitle>
              <CreateRequestDialog caseId={record.id} />
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {record.requests.length === 0 ? (
                <EmptyState title="Запросов пока нет" description="Запросите у клиента информацию или действие." />
              ) : (
                <ul>
                  {record.requests.map((request) => (
                    <li key={request.id} className="border-t border-[var(--color-border)] px-6 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{request.title}</p>
                          {request.description ? (
                            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{request.description}</p>
                          ) : null}
                          <p className="mt-1.5 text-xs text-[var(--color-ink-subtle)]">
                            {REQUEST_TYPE_LABELS[request.type]} · создан {formatDate(request.createdAt)}
                            {request.createdBy ? `, ${request.createdBy.name}` : ''}
                            {request.completedAt ? ` · выполнен ${formatDate(request.completedAt)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <DeadlineBadge
                            deadline={request.deadline}
                            settled={request.status === 'COMPLETED' || request.status === 'CANCELLED'}
                          />
                          <RequestStatusBadge status={request.status} />
                          {request.status === 'OPEN' || request.status === 'OVERDUE' ? (
                            <CancelRequestButton requestId={request.id} caseId={record.id} />
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {active === 'tasks' ? (
          <Card>
            <CardHeader>
              <CardTitle>Задачи</CardTitle>
              <CreateTaskDialog caseId={record.id} team={team} />
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {record.tasks.length === 0 ? (
                <EmptyState title="По делу нет задач" />
              ) : (
                <ul>
                  {record.tasks.map((task) => (
                    <li key={task.id} className="border-t border-[var(--color-border)] px-6 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{task.title}</p>
                          {task.description ? (
                            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{task.description}</p>
                          ) : null}
                          <p className="mt-1.5 text-xs text-[var(--color-ink-subtle)]">
                            {task.assignedTo?.name ?? 'Без исполнителя'} ·{' '}
                            {TASK_VISIBILITY_LABELS[task.visibility]}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <DeadlineBadge
                            deadline={task.deadline}
                            settled={task.status === 'COMPLETED' || task.status === 'CANCELLED'}
                          />
                          <TaskStatusBadge status={task.status} />
                          <TaskToggle taskId={task.id} caseId={record.id} status={task.status} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {active === 'messages' ? (
          <Card>
            <CardHeader>
              <CardTitle>Переписка с клиентом: {record.client.firstName}</CardTitle>
            </CardHeader>
            <CardContent>
              <MessageThread caseId={record.id} messages={record.messages} currentUserId={profile.id} />
            </CardContent>
          </Card>
        ) : null}

        {active === 'activity' ? (
          <Card>
            <CardHeader>
              <CardTitle>История дела</CardTitle>
              <p className="text-xs text-[var(--color-ink-subtle)]">Только дополняется — записи не редактируются.</p>
            </CardHeader>
            <CardContent>
              <ActivityFeed events={record.activity} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">{label}</p>
      {children}
    </div>
  );
}
