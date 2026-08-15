import Link from 'next/link';
import type { ActivityEvent } from '@/lib/types';
import { formatDateTime, formatRelative } from '@/lib/utils';

const EVENT_COPY: Record<string, (payload: Record<string, unknown>) => string> = {
  CASE_CREATED: (p) => `Дело создано по воркфлоу «${String(p.templateName ?? 'без шаблона')}»`,
  CASE_UPDATED: () => 'Данные дела изменены',
  CASE_STATUS_CHANGED: () => 'Статус дела изменён',
  STAGE_CHANGED: (p) =>
    `Этап изменён${p.from ? ` с «${String(p.from)}»` : ''} на «${String(p.to ?? '—')}»`,
  STAGE_COMPLETED: (p) => `Этап «${String(p.name ?? '')}» завершён`,
  DOCUMENT_REQUESTED: (p) => `Запрошен документ «${String(p.name ?? '')}»`,
  DOCUMENT_UPLOADED: (p) =>
    `Загружен файл ${String(p.filename ?? '')}${p.version ? ` (в. ${String(p.version)})` : ''}`,
  DOCUMENT_APPROVED: (p) => `Принят документ ${String(p.filename ?? '')}`,
  DOCUMENT_REJECTED: (p) => `Отклонён документ ${String(p.filename ?? '')}`,
  REQUEST_CREATED: (p) => `Новый запрос: ${String(p.title ?? '')}`,
  REQUEST_COMPLETED: (p) => `Запрос выполнен: ${String(p.title ?? '')}`,
  REQUEST_CANCELLED: (p) => `Запрос отменён: ${String(p.title ?? '')}`,
  TASK_CREATED: (p) => `Создана задача: ${String(p.title ?? '')}`,
  TASK_COMPLETED: (p) => `Задача выполнена: ${String(p.title ?? '')}`,
  MESSAGE_SENT: (p) => `Сообщение: «${String(p.excerpt ?? '')}»`,
  DEADLINE_MISSED: (p) => `Пропущен срок: ${String(p.title ?? '')}`,
  CRM_SYNCED: (p) => `Синхронизация с CRM (${String(p.event ?? 'обновление')})`,
};

const ACTOR_DOT: Record<string, string> = {
  USER: 'bg-[var(--color-accent)]',
  CLIENT: 'bg-[var(--color-success)]',
  SYSTEM: 'bg-[var(--color-ink-subtle)]',
  INTEGRATION: 'bg-[var(--color-warning)]',
};

export function describeEvent(event: ActivityEvent): string {
  const renderer = EVENT_COPY[event.eventType];
  return renderer ? renderer(event.payload) : event.eventType.replace(/_/g, ' ').toLowerCase();
}

export function ActivityFeed({
  events,
  showCase = false,
  emptyLabel = 'Пока ничего не происходило.',
}: {
  events: ActivityEvent[];
  showCase?: boolean;
  emptyLabel?: string;
}) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--color-ink-muted)]">{emptyLabel}</p>;
  }

  return (
    <ol className="relative space-y-5 pl-5">
      <span className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--color-border)]" aria-hidden />
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={`absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--color-surface)] ${
              ACTOR_DOT[event.actorType] ?? 'bg-[var(--color-ink-subtle)]'
            }`}
            aria-hidden
          />
          <p className="text-sm">{describeEvent(event)}</p>
          <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
            {event.actorLabel ?? 'Система'} ·{' '}
            <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>{' '}
            <span className="text-[var(--color-ink-subtle)]">({formatRelative(event.createdAt)})</span>
            {showCase && event.case ? (
              <>
                {' · '}
                <Link href={`/cases/${event.case.id}`} className="text-[var(--color-accent)]">
                  {event.case.title}
                </Link>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ol>
  );
}
