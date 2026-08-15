import type { Metadata } from 'next';
import { UploadForm } from '@/components/case/upload-form';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DeadlineBadge, RequestStatusBadge } from '@/components/ui/status';
import { api } from '@/lib/api';
import { requireClient } from '@/lib/session';
import type { ClientRequestRecord, PortalRequests } from '@/lib/types';
import { formatDate, titleCase } from '@/lib/utils';
import { CompleteRequestButton } from '../complete-request-button';

export const metadata: Metadata = { title: 'Requests' };

export default async function PortalRequestsPage() {
  await requireClient();
  const requests = await api<PortalRequests>('/portal/requests');

  const groups: Array<{ key: string; title: string; items: ClientRequestRecord[]; description?: string }> = [
    { key: 'overdue', title: 'Overdue', items: requests.overdue, description: 'These are past their deadline.' },
    { key: 'open', title: 'Open', items: requests.open },
    { key: 'completed', title: 'Completed', items: requests.completed },
  ];

  const total = requests.open.length + requests.overdue.length + requests.completed.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Everything your case team has asked you for.
        </p>
      </div>

      {total === 0 ? (
        <Card>
          <EmptyState title="Nothing requested" description="You are all caught up." />
        </Card>
      ) : (
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <Card key={group.key}>
              <CardHeader>
                <div>
                  <CardTitle>{group.title}</CardTitle>
                  {group.description ? (
                    <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{group.description}</p>
                  ) : null}
                </div>
                <span className="text-sm text-[var(--color-ink-muted)]">{group.items.length}</span>
              </CardHeader>
              <ul>
                {group.items.map((request) => (
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
                          <span className="text-xs text-[var(--color-ink-subtle)]">
                            {titleCase(request.type)}
                            {request.completedAt ? ` · done ${formatDate(request.completedAt)}` : ''}
                          </span>
                        </div>
                        {request.requirement ? (
                          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                            Action: upload <span className="font-medium">{request.requirement.name}</span>
                          </p>
                        ) : null}
                      </div>

                      {request.status === 'OPEN' || request.status === 'OVERDUE' ? (
                        request.requirement ? (
                          <UploadForm
                            caseId={request.caseId}
                            requirementId={request.requirement.id}
                            portal
                            label="Upload"
                          />
                        ) : (
                          <CompleteRequestButton requestId={request.id} />
                        )
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}
    </div>
  );
}
