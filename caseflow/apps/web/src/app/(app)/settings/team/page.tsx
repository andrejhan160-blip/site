import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { canAdminister, requireStaff } from '@/lib/session';
import type { TeamMember } from '@/lib/types';
import { ROLE_LABELS, countOf } from '@/lib/i18n';
import { formatRelative } from '@/lib/utils';
import { SettingsNav } from '../settings-nav';
import { InviteMemberDialog, MemberRoleForm } from './team-forms';

export const metadata: Metadata = { title: 'Команда' };

export default async function TeamPage() {
  const profile = await requireStaff();
  const members = await api<TeamMember[]>('/organization/users');
  const admin = canAdminister(profile.role);

  return (
    <>
      <PageHeader
        title="Настройки"
        description="Кто работает в организации и что каждому доступно."
        actions={admin ? <InviteMemberDialog /> : undefined}
      />
      <SettingsNav />

      <Card className="max-w-4xl overflow-hidden">
        <ul>
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} src={member.avatarUrl} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {member.name}
                    {!member.isActive ? <Badge tone="neutral">Отключён</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-[var(--color-ink-muted)]">{member.email}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                    {ROLE_LABELS[member.role]} ·{' '}
                    {countOf(member._count.assignedCases, 'дело', 'дела', 'дел')} ·{' '}
                    {member.lastLoginAt ? `вход ${formatRelative(member.lastLoginAt)}` : 'ни разу не входил'}
                  </p>
                </div>
              </div>

              {admin ? (
                <MemberRoleForm
                  userId={member.id}
                  role={member.role}
                  isActive={member.isActive}
                  disabled={member.id === profile.id}
                />
              ) : (
                <Badge tone="neutral">{ROLE_LABELS[member.role]}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
