import type { Metadata } from 'next';
import { MessageThread } from '@/components/case/message-thread';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiError } from '@/lib/api';
import { requireClient } from '@/lib/session';
import type { PortalThread } from '@/lib/types';

export const metadata: Metadata = { title: 'Сообщения' };

export default async function PortalMessagesPage() {
  const profile = await requireClient();

  let threads: PortalThread[] = [];
  try {
    threads = await api<PortalThread[]>('/portal/messages');
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Сообщения</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Пишите команде по вашему делу. Вся переписка привязана к делу.
        </p>
      </div>

      {threads.length === 0 ? (
        <Card>
          <EmptyState title="Переписки пока нет" description="Команда напишет вам здесь." />
        </Card>
      ) : (
        threads.map((thread) => (
          <Card key={thread.id}>
            <CardHeader>
              <div>
                <CardTitle>{thread.title}</CardTitle>
                {thread.assignedUser ? (
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">специалист: {thread.assignedUser.name}</p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <MessageThread
                caseId={thread.id}
                messages={thread.messages}
                portal
                currentUserId={profile.id}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
