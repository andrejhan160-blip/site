import type {
  CaseStatus,
  DocumentStatus,
  RequestStatus,
  RequirementStatus,
  StageStatus,
  TaskStatus,
} from '@/lib/types';
import { titleCase } from '@/lib/utils';
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

const LABELS: Record<string, string> = {
  PENDING: 'Not uploaded',
  UNDER_REVIEW: 'Under review',
  ON_HOLD: 'On hold',
  IN_PROGRESS: 'In progress',
};

function label(status: string): string {
  return LABELS[status] ?? titleCase(status);
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge tone={CASE_TONES[status]}>{label(status)}</Badge>;
}

export function StageStatusBadge({ status }: { status: StageStatus }) {
  return <Badge tone={STAGE_TONES[status]}>{label(status)}</Badge>;
}

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return <Badge tone={REQUIREMENT_TONES[status]}>{label(status)}</Badge>;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={DOCUMENT_TONES[status]}>{label(status)}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_TONES[status]}>{label(status)}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_TONES[status]}>{label(status)}</Badge>;
}

export function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const date = new Date(deadline);
  const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const text = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);

  if (days < 0) return <Badge tone="danger">Overdue · {text}</Badge>;
  if (days <= 2) return <Badge tone="warning">Due {days === 0 ? 'today' : `in ${days}d`} · {text}</Badge>;
  return <Badge tone="neutral">Due {text}</Badge>;
}
