import Link from 'next/link';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';
import { api } from '@/lib/api';
import { requireClient } from '@/lib/session';
import type { NotificationRecord } from '@/lib/types';
import { PortalNav } from './portal-nav';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireClient();
  const notifications = await api<{ items: NotificationRecord[]; unread: number }>('/notifications');
  const organization = profile.organization;

  return (
    <div
      className="flex min-h-screen flex-col"
      data-branded
      style={{ ['--brand-primary' as string]: organization.primaryColor }}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
            {organization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={organization.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-white">
                {organization.name.charAt(0)}
              </span>
            )}
            <span className="truncate font-semibold">{organization.name}</span>
          </Link>

          <div className="flex items-center gap-1">
            <NotificationBell notifications={notifications.items} unread={notifications.unread} />
            <UserMenu name={profile.name} email={profile.email} role="CLIENT" />
          </div>
        </div>
        <PortalNav />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-[var(--color-border)] px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-subtle)]">
          <span>{organization.name}</span>
          {organization.supportEmail ? (
            <a href={`mailto:${organization.supportEmail}`} className="text-[var(--color-accent)]">
              {organization.supportEmail}
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
