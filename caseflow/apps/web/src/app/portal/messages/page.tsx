import type { Metadata } from 'next';
import { MessageThread } from '@/components/case/message-thread';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiError } from '@/lib/api';
import { requireClient } from '@/lib/session';
import type { PortalThread } from '@/lib/types';

export const metadata: Metadata = { title: 'Messages' };

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
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Talk to your case team. Everything here is attached to your case.
        </p>
      </div>

      {threads.length === 0 ? (
        <Card>
          <EmptyState title="No conversations yet" description="Your case team will reach out here." />
        </Card>
      ) : (
        threads.map((thread) => (
          <Card key={thread.id}>
            <CardHeader>
              <div>
                <CardTitle>{thread.title}</CardTitle>
                {thread.assignedUser ? (
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">with {thread.assignedUser.name}</p>
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
