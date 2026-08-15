'use client';

import { Send } from 'lucide-react';
import { useActionState, useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleState } from '@/lib/action-state';
import { sendMessage } from '@/lib/actions';
import type { MessageRecord } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

export function MessageThread({
  caseId,
  messages,
  portal = false,
  currentUserId,
}: {
  caseId: string;
  messages: MessageRecord[];
  portal?: boolean;
  currentUserId: string;
}) {
  const [state, formAction] = useActionState(sendMessage, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.done && state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-ink-muted)]">
            Сообщений пока нет. Всё написанное здесь видят обе стороны.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender?.id === currentUserId;
            return (
              <div key={message.id} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
                <Avatar name={message.sender?.name ?? 'Система'} size="sm" />
                <div className={cn('max-w-[min(34rem,80%)]', mine && 'text-right')}>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                      mine
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-surface-muted)] text-[var(--color-ink)]',
                    )}
                  >
                    {message.body}
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-ink-subtle)]">
                    {message.sender?.name ?? 'Система'} · {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form ref={formRef} action={formAction} className="space-y-2 border-t border-[var(--color-border)] pt-4">
        <input type="hidden" name="caseId" value={caseId} />
        {portal ? <input type="hidden" name="portal" value="true" /> : null}
        <Textarea
          name="body"
          rows={3}
          required
          placeholder={placeholderFor(portal)}
          className="resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          {!state.ok && state.message ? (
            <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
          ) : (
            <span className="text-xs text-[var(--color-ink-subtle)]">
              Ответы появляются при обновлении — постоянное соединение не нужно.
            </span>
          )}
          <SubmitButton pendingLabel="Отправляем…">
            <Send />
            Отправить
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

function placeholderFor(portal: boolean): string {
  return portal ? 'Написать вашему специалисту…' : 'Написать клиенту…';
}
