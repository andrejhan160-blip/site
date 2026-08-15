import Link from 'next/link';
import type { ActivityEvent } from '@/lib/types';
import { formatDateTime, formatRelative } from '@/lib/utils';

const EVENT_COPY: Record<string, (payload: Record<string, unknown>) => string> = {
  CASE_CREATED: (p) => `Case created from "${String(p.templateName ?? 'a workflow')}"`,
  CASE_UPDATED: () => 'Case details updated',
  CASE_STATUS_CHANGED: () => 'Case status changed',
  STAGE_CHANGED: (p) => `Stage moved${p.from ? ` from ${String(p.from)}` : ''} to ${String(p.to ?? '—')}`,
  STAGE_COMPLETED: (p) => `Stage "${String(p.name ?? '')}" completed`,
  DOCUMENT_REQUESTED: (p) => `Requested "${String(p.name ?? 'a document')}"`,
  DOCUMENT_UPLOADED: (p) => `Uploaded ${String(p.filename ?? 'a document')}${p.version ? ` (v${String(p.version)})` : ''}`,
  DOCUMENT_APPROVED: (p) => `Approved ${String(p.filename ?? 'a document')}`,
  DOCUMENT_REJECTED: (p) => `Rejected ${String(p.filename ?? 'a document')}`,
  REQUEST_CREATED: (p) => `New request: ${String(p.title ?? '')}`,
  REQUEST_COMPLETED: (p) => `Request completed: ${String(p.title ?? '')}`,
  REQUEST_CANCELLED: (p) => `Request cancelled: ${String(p.title ?? '')}`,
  TASK_CREATED: (p) => `Task created: ${String(p.title ?? '')}`,
  TASK_COMPLETED: (p) => `Task completed: ${String(p.title ?? '')}`,
  MESSAGE_SENT: (p) => `Message: "${String(p.excerpt ?? '')}"`,
  DEADLINE_MISSED: (p) => `Deadline missed: ${String(p.title ?? '')}`,
  CRM_SYNCED: (p) => `Synced from CRM (${String(p.event ?? 'update')})`,
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
  emptyLabel = 'Nothing has happened yet.',
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
            {event.actorLabel ?? 'System'} · <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>{' '}
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
