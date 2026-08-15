import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { SearchField } from '@/components/forms/search-field';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { canManage, requireStaff } from '@/lib/session';
import type { ClientListRow, Paginated } from '@/lib/types';
import { formatRelative } from '@/lib/utils';
import { NewClientDialog } from './new-client-dialog';

export const metadata: Metadata = { title: 'Clients' };

const STATUS_TONES = { ACTIVE: 'accent', COMPLETED: 'success', NEW: 'neutral' } as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const profile = await requireStaff();
  const params = await searchParams;

  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page);

  const clients = await api<Paginated<ClientListRow>>(`/clients?${query.toString()}`);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone your team is running a process for."
        actions={canManage(profile.role) ? <NewClientDialog /> : undefined}
      />

      <div className="mb-4">
        <SearchField placeholder="Search name, email or phone" />
      </div>

      <Card className="overflow-hidden">
        {clients.items.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description={
              params.search
                ? 'No client matches that search.'
                : 'Create your first client to open a case for them.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Active cases</th>
                  <th className="px-6 py-3 font-medium">Assigned to</th>
                  <th className="px-6 py-3 font-medium">Latest activity</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.items.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-muted)]"
                  >
                    <td className="px-6 py-3.5">
                      <Link href={`/clients/${client.id}`} className="flex items-center gap-3">
                        <Avatar name={`${client.firstName} ${client.lastName}`} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {client.firstName} {client.lastName}
                          </span>
                          <span className="block truncate text-xs text-[var(--color-ink-muted)]">
                            {client.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 tabular-nums">
                      {client.activeCaseCount}
                      {client.totalCaseCount > client.activeCaseCount ? (
                        <span className="text-[var(--color-ink-subtle)]"> / {client.totalCaseCount}</span>
                      ) : null}
                    </td>
                    <td className="px-6 py-3.5 text-[var(--color-ink-muted)]">
                      {client.assignedUser?.name ?? '—'}
                    </td>
                    <td className="px-6 py-3.5 text-[var(--color-ink-muted)]">
                      {formatRelative(client.lastActivityAt)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge tone={STATUS_TONES[client.status]}>
                        {client.status === 'NEW' ? 'No cases' : client.status === 'ACTIVE' ? 'Active' : 'Completed'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {clients.pageCount > 1 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
          Page {clients.page} of {clients.pageCount} · {clients.total} clients
        </p>
      ) : null}
    </>
  );
}
