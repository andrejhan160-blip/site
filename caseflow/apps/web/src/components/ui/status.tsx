import type {
  CaseStatus,
  DocumentStatus,
  RequestStatus,
  RequirementStatus,
  StageStatus,
  TaskStatus,
} from '@/lib/types';
import {
  CASE_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  REQUIREMENT_STATUS_LABELS,
  STAGE_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from '@/lib/i18n';
import { Badge } from './badge';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const CASE_TONES: Record<CaseStatus, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'accent',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const STAGE_TONES: Record<StageStatus, Tone> = {
  PENDING: 'neutral',
  ACTIVE: 'accent',
  COMPLETED: 'success',
  BLOCKED: 'danger',
};

const REQUIREMENT_TONES: Record<RequirementStatus, Tone> = {
  PENDING: 'warning',
  UPLOADED: 'info',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  WAIVED: 'neutral',
};

const DOCUMENT_TONES: Record<DocumentStatus, Tone> = {
  UPLOADED: 'info',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

const REQUEST_TONES: Record<RequestStatus, Tone> = {
  OPEN: 'warning',
  COMPLETED: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
};

const TASK_TONES: Record<TaskStatus, Tone> = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge tone={CASE_TONES[status]}>{CASE_STATUS_LABELS[status]}</Badge>;
}

export function StageStatusBadge({ status }: { status: StageStatus }) {
  return <Badge tone={STAGE_TONES[status]}>{STAGE_STATUS_LABELS[status]}</Badge>;
}

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return <Badge tone={REQUIREMENT_TONES[status]}>{REQUIREMENT_STATUS_LABELS[status]}</Badge>;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={DOCUMENT_TONES[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_TONES[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_TONES[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

/**
 * Срок показывается только пока по нему есть работа: у принятого документа или
 * закрытого запроса дата — это история, а не проблема.
 */
export function DeadlineBadge({ deadline, settled = false }: { deadline: string | null; settled?: boolean }) {
  if (!deadline || settled) return null;

  const date = new Date(deadline);
  const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const text = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);

  if (days < 0) return <Badge tone="danger">Просрочено · {text}</Badge>;
  if (days === 0) return <Badge tone="warning">Сегодня · {text}</Badge>;
  if (days <= 2) return <Badge tone="warning">Через {days} дн. · {text}</Badge>;
  return <Badge tone="neutral">До {text}</Badge>;
}
