'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/**
 * URL-driven tabs. Keeping the active tab in the query string means a case tab
 * can be linked to directly from a notification.
 */
export function Tabs({ items, param = 'tab' }: { items: TabItem[]; param?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(param) ?? items[0]?.key;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
      {items.map((item) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(param, item.key);
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={`${pathname}?${params.toString()}`}
            scroll={false}
            className={cn(
              '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
            )}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                  isActive
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
