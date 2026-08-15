'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { markNotificationsRead } from '@/lib/actions';
import type { NotificationRecord } from '@/lib/types';
import { formatRelative } from '@/lib/utils';

export function NotificationBell({
  notifications,
  unread,
}: {
  notifications: NotificationRecord[];
  unread: number;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="relative rounded-lg p-2 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
        <span className="sr-only">Уведомления</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <p className="text-sm font-semibold">Уведомления</p>
            {unread > 0 ? (
              <form action={markNotificationsRead}>
                <button type="submit" className="text-xs font-medium text-[var(--color-accent)]">
                  Прочитать все
                </button>
              </form>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-ink-muted)]">
                Пока ничего нового.
              </p>
            ) : (
              notifications.map((notification) => {
                const href = notification.linkUrl
                  ? new URL(notification.linkUrl).pathname + new URL(notification.linkUrl).search
                  : '#';
                return (
                  <Link
                    key={notification.id}
                    href={href}
                    className="block border-b border-[var(--color-border)] px-4 py-3 last:border-0 hover:bg-[var(--color-surface-muted)]"
                  >
                    <p className="flex items-start gap-2 text-sm font-medium">
                      {!notification.readAt ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                      ) : null}
                      {notification.subject}
                    </p>
                    <p className="mt-0.5 line-clamp-2 pl-3.5 text-xs text-[var(--color-ink-muted)]">
                      {notification.body}
                    </p>
                    <p className="mt-1 pl-3.5 text-[11px] text-[var(--color-ink-subtle)]">
                      {formatRelative(notification.createdAt)}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
