import { MobileNav, Sidebar } from '@/components/layout/sidebar';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';
import { api } from '@/lib/api';
import { requireStaff } from '@/lib/session';
import type { NotificationRecord } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const notifications = await api<{ items: NotificationRecord[]; unread: number }>('/notifications');

  return (
    <div
      className="flex min-h-screen"
      data-branded
      style={{ ['--brand-primary' as string]: profile.organization.primaryColor }}
    >
      <Sidebar organizationName={profile.organization.name} logoUrl={profile.organization.logoUrl} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-4 py-3 backdrop-blur lg:px-8">
          <p className="text-sm text-[var(--color-ink-muted)] lg:hidden">{profile.organization.name}</p>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1">
            <NotificationBell notifications={notifications.items} unread={notifications.unread} />
            <UserMenu name={profile.name} email={profile.email} role={profile.role} />
          </div>
        </header>

        <MobileNav />

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
