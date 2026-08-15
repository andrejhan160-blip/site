import type {
  CaseStatus,
  DocumentStatus,
  RequestStatus,
  RequestType,
  RequirementStatus,
  Role,
  StageStatus,
  TaskStatus,
  TaskVisibility,
} from './types';

/**
 * Единственное место, где значения перечислений превращаются в слова для
 * пользователя. Ярлыки не выводятся из имён констант: «UNDER_REVIEW» — это
 * «На проверке», а не «Under review».
 */

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  SPECIALIST: 'Специалист',
  CLIENT: 'Клиент',
};

export const ROLE_HINTS: Record<Exclude<Role, 'OWNER' | 'CLIENT'>, string> = {
  ADMIN: 'настройки, команда, воркфлоу, интеграции',
  MANAGER: 'клиенты и дела',
  SPECIALIST: 'только назначенные ему дела',
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'В работе',
  ON_HOLD: 'Приостановлено',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  PENDING: 'Предстоит',
  ACTIVE: 'Текущий этап',
  COMPLETED: 'Завершён',
  BLOCKED: 'Заблокирован',
};

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  PENDING: 'Не загружен',
  UPLOADED: 'Загружен',
  UNDER_REVIEW: 'На проверке',
  APPROVED: 'Принят',
  REJECTED: 'Отклонён',
  WAIVED: 'Не требуется',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  UPLOADED: 'Загружен',
  UNDER_REVIEW: 'На проверке',
  APPROVED: 'Принят',
  REJECTED: 'Отклонён',
  EXPIRED: 'Просрочен',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  OPEN: 'Открыт',
  COMPLETED: 'Выполнен',
  OVERDUE: 'Просрочен',
  CANCELLED: 'Отменён',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  DOCUMENT: 'Документ',
  INFORMATION: 'Информация',
  ACTION: 'Действие',
  PAYMENT_CONFIRMATION: 'Подтверждение оплаты',
  APPOINTMENT: 'Запись на приём',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: 'Открыта',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнена',
  CANCELLED: 'Отменена',
};

export const TASK_VISIBILITY_LABELS: Record<TaskVisibility, string> = {
  INTERNAL: 'Только для команды',
  CLIENT: 'Только клиенту',
  BOTH: 'Команде и клиенту',
};

/** Склонение существительных: plural(3, 'дело', 'дела', 'дел') → 'дела'. */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export const countOf = (count: number, one: string, few: string, many: string): string =>
  `${count} ${plural(count, one, few, many)}`;
