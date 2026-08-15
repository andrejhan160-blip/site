import { Check, Circle, CircleDot, Lock } from 'lucide-react';
import type { Stage } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

const STATUS_META = {
  COMPLETED: { icon: Check, ring: 'bg-[var(--color-success)] text-white', label: 'Завершён' },
  ACTIVE: { icon: CircleDot, ring: 'bg-[var(--color-accent)] text-white', label: 'Текущий этап' },
  BLOCKED: { icon: Lock, ring: 'bg-[var(--color-danger)] text-white', label: 'Заблокирован' },
  PENDING: {
    icon: Circle,
    ring: 'bg-[var(--color-surface-muted)] text-[var(--color-ink-subtle)]',
    label: 'Предстоит',
  },
} as const;

/**
 * Vertical stage timeline shared by the employee workspace and the client
 * portal — both read the same case stages, so they cannot drift apart.
 */
export function StageTimeline({
  stages,
  showRequirements = false,
}: {
  stages: Stage[];
  showRequirements?: boolean;
}) {
  return (
    <ol className="relative">
      {stages.map((stage, index) => {
        const meta = STATUS_META[stage.status];
        const Icon = meta.icon;
        const isLast = index === stages.length - 1;

        return (
          <li key={stage.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  'absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5',
                  stage.status === 'COMPLETED' ? 'bg-[var(--color-success)]/30' : 'bg-[var(--color-border)]',
                )}
                aria-hidden
              />
            ) : null}

            <span
              className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.ring)}
            >
              <Icon className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p
                  className={cn(
                    'font-medium',
                    stage.status === 'PENDING' ? 'text-[var(--color-ink-muted)]' : 'text-[var(--color-ink)]',
                  )}
                >
                  {stage.name}
                </p>
                <span className="text-xs text-[var(--color-ink-subtle)]">
                  {stage.status === 'COMPLETED' && stage.completedAt
                    ? `Завершён ${formatDate(stage.completedAt)}`
                    : meta.label}
                </span>
              </div>

              {stage.description ? (
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{stage.description}</p>
              ) : null}

              {showRequirements && stage.requirements && stage.requirements.length > 0 ? (
                <ul className="mt-2.5 space-y-1.5">
                  {stage.requirements.map((requirement) => (
                    <li key={requirement.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          requirement.status === 'APPROVED'
                            ? 'bg-[var(--color-success)]'
                            : requirement.status === 'REJECTED'
                              ? 'bg-[var(--color-danger)]'
                              : requirement.status === 'UNDER_REVIEW' || requirement.status === 'UPLOADED'
                                ? 'bg-[var(--color-info)]'
                                : 'bg-[var(--color-ink-subtle)]',
                        )}
                        aria-hidden
                      />
                      <span className="text-[var(--color-ink-muted)]">{requirement.name}</span>
                      {!requirement.required ? (
                        <span className="text-xs text-[var(--color-ink-subtle)]">(по желанию)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
