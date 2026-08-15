import type { Metadata } from 'next';
import Link from 'next/link';
import { FilterSelect } from '@/components/forms/filter-select';
import { SearchField } from '@/components/forms/search-field';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { CaseStatusBadge } from '@/components/ui/status';
import { api } from '@/lib/api';
import { canManage, requireStaff } from '@/lib/session';
import type { CaseListRow, ClientListRow, Paginated, TeamMember, WorkflowTemplateSummary } from '@/lib/types';
import { formatRelative } from '@/lib/utils';
import { NewCaseDialog } from './new-case-dialog';

export const metadata: Metadata = { title: 'Cases' };

const FILTER_KEYS = ['search', 'status', 'assignedUserId', 'workflowTemplateId', 'stageName', 'clientId', 'overdue', 'page'];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireStaff();
  const params = await searchParams;

  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = params[key];
    if (value) query.set(key, value);
  }

  const [cases, templates, team, clients] = await Promise.all([
    api<Paginated<CaseListRow>>(`/cases?${query.toString()}`),
    api<WorkflowTemplateSummary[]>('/workflow-templates'),
    api<TeamMember[]>('/organization/users'),
    api<Paginated<ClientListRow>>('/clients?pageSize=100'),
  ]);

  const stageNames = [...new Set(templates.flatMap((template) => template.stages.map((stage) => stage.name)))];

  return (
    <>
      <PageHeader
        title="Cases"
        description="Every process your team is running, with the stage it is sitting in."
        actions={
          canManage(profile.role) ? (
            <NewCaseDialog clients={clients.items} templates={templates} team={team} />
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField placeholder="Search case, client or CRM id" />
        <FilterSelect
          name="status"
          label="Status"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'ON_HOLD', label: 'On hold' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
        <FilterSelect
          name="assignedUserId"
          label="Employee"
          options={team.map((member) => ({ value: member.id, label: member.name }))}
        />
        <FilterSelect
          name="workflowTemplateId"
          label="Workflow"
          options={templates.map((template) => ({ value: template.id, label: template.name }))}
        />
        <FilterSelect
          name="stageName"
          label="Stage"
          options={stageNames.map((name) => ({ value: name, label: name }))}
        />
        <FilterSelect
          name="clientId"
          label="Client"
          options={clients.items.map((client) => ({
            value: client.id,
            label: `${client.firstName} ${client.lastName}`,
          }))}
        />
        <FilterSelect name="overdue" label="Overdue" options={[{ value: 'true', label: 'Overdue only' }]} />
      </div>

      <Card className="overflow-hidden">
        {cases.items.length === 0 ? (
          <EmptyState
            title="No cases match"
            description="Adjust the filters, or open a new case for a client."
          />
        ) : (
          <ul>
            {cases.items.map((item) => (
              <li key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                <Link
                  href={`/cases/${item.id}`}
                  className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-4 transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                      {item.client.firstName} {item.client.lastName}
                      {item.externalCrmEntityId ? ` · CRM #${item.externalCrmEntityId}` : ''}
                      {` · updated ${formatRelative(item.lastActivityAt)}`}
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-muted)]">
                    {item.currentStage?.name ?? 'No stage'}
                  </span>

                  <CaseStatusBadge status={item.status} />

                  <div className="flex items-center gap-2">
                    {item.assignedUser ? (
                      <>
                        <Avatar name={item.assignedUser.name} size="sm" />
                        <span className="hidden text-sm text-[var(--color-ink-muted)] sm:inline">
                          {item.assignedUser.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-[var(--color-ink-subtle)]">Unassigned</span>
                    )}
                  </div>

                  <div className="w-32">
                    <Progress value={item.progress} showLabel />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {cases.pageCount > 1 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
          Page {cases.page} of {cases.pageCount} · {cases.total} cases
        </p>
      ) : null}
    </>
  );
}
