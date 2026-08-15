'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { logout } from '@/lib/actions';
import { titleCase } from '@/lib/utils';

export function UserMenu({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-muted)]">
        <Avatar name={name} size="sm" />
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight">{name}</span>
          <span className="block text-[11px] text-[var(--color-ink-subtle)]">{titleCase(role)}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--color-ink-subtle)]" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 card-shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-[var(--color-ink-muted)]">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
