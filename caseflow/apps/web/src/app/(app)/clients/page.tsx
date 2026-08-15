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
import { countOf } from '@/lib/i18n';
import { formatRelative } from '@/lib/utils';
import { NewClientDialog } from './new-client-dialog';

export const metadata: Metadata = { title: 'Клиенты' };

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
        title="Клиенты"
        description="Все, чьи дела ведёт ваша команда."
        actions={canManage(profile.role) ? <NewClientDialog /> : undefined}
      />

      <div className="mb-4">
        <SearchField placeholder="Поиск по имени, почте или телефону" />
      </div>

      <Card className="overflow-hidden">
        {clients.items.length === 0 ? (
          <EmptyState
            title="Клиентов пока нет"
            description={
              params.search
                ? 'По этому запросу никого не нашлось.'
                : 'Создайте первого клиента, чтобы открыть для него дело.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
                  <th className="px-6 py-3 font-medium">Клиент</th>
                  <th className="px-6 py-3 font-medium">Дел в работе</th>
                  <th className="px-6 py-3 font-medium">Ответственный</th>
                  <th className="px-6 py-3 font-medium">Последняя активность</th>
                  <th className="px-6 py-3 font-medium">Статус</th>
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
                        {client.status === 'NEW' ? 'Без дел' : client.status === 'ACTIVE' ? 'В работе' : 'Завершены'}
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
          Страница {clients.page} из {clients.pageCount} · {countOf(clients.total, 'клиент', 'клиента', 'клиентов')}
        </p>
      ) : null}
    </>
  );
}
