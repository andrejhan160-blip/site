'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/portal', label: 'Обзор' },
  { href: '/portal/documents', label: 'Документы' },
  { href: '/portal/requests', label: 'Запросы' },
  { href: '/portal/messages', label: 'Сообщения' },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2">
      {TABS.map((tab) => {
        const active = tab.href === '/portal' ? pathname === '/portal' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-ink-muted)]',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
