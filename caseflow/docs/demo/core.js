/** Правила и форматирование — те же, что в продукте. */

const LABELS = {
  requirement: {
    PENDING: 'Не загружен',
    UPLOADED: 'Загружен',
    UNDER_REVIEW: 'На проверке',
    APPROVED: 'Принят',
    REJECTED: 'Отклонён',
    WAIVED: 'Не требуется',
  },
  document: { UPLOADED: 'Загружен', UNDER_REVIEW: 'На проверке', APPROVED: 'Принят', REJECTED: 'Отклонён' },
  request: { OPEN: 'Открыт', COMPLETED: 'Выполнен', OVERDUE: 'Просрочен', CANCELLED: 'Отменён' },
  task: { OPEN: 'Открыта', IN_PROGRESS: 'В работе', COMPLETED: 'Выполнена', CANCELLED: 'Отменена' },
  stage: { PENDING: 'Предстоит', ACTIVE: 'Текущий этап', COMPLETED: 'Завершён', BLOCKED: 'Заблокирован' },
  case: { ACTIVE: 'В работе', ON_HOLD: 'Приостановлено', COMPLETED: 'Завершено', CANCELLED: 'Отменено' },
  requestType: {
    DOCUMENT: 'Документ',
    INFORMATION: 'Информация',
    ACTION: 'Действие',
    PAYMENT_CONFIRMATION: 'Подтверждение оплаты',
    APPOINTMENT: 'Запись на приём',
  },
  visibility: { INTERNAL: 'Только для команды', CLIENT: 'Только клиенту', BOTH: 'Команде и клиенту' },
  role: { OWNER: 'Владелец', ADMIN: 'Администратор', MANAGER: 'Менеджер', SPECIALIST: 'Специалист' },
};

const TONES = {
  requirement: { PENDING: 'warning', UPLOADED: 'info', UNDER_REVIEW: 'info', APPROVED: 'success', REJECTED: 'danger', WAIVED: 'neutral' },
  document: { UPLOADED: 'info', UNDER_REVIEW: 'info', APPROVED: 'success', REJECTED: 'danger' },
  request: { OPEN: 'warning', COMPLETED: 'success', OVERDUE: 'danger', CANCELLED: 'neutral' },
  task: { OPEN: 'warning', IN_PROGRESS: 'info', COMPLETED: 'success', CANCELLED: 'neutral' },
  case: { ACTIVE: 'accent', ON_HOLD: 'warning', COMPLETED: 'success', CANCELLED: 'neutral' },
};

/**
 * Формула прогресса из apps/api/src/modules/cases/case-progress.ts:
 * 40% — продвижение по этапам, 60% — комплектность документов. Завершённый
 * этап считается целиком, текущий — по своей комплектности, документ на
 * проверке — за половину.
 */
const REQUIREMENT_SCORE = { PENDING: 0, REJECTED: 0, UPLOADED: 0.5, UNDER_REVIEW: 0.5, APPROVED: 1, WAIVED: 1 };

function fulfilment(requirements) {
  const scored = requirements.filter((r) => r.required);
  if (scored.length === 0) return null;
  return scored.reduce((sum, r) => sum + REQUIREMENT_SCORE[r.status], 0) / scored.length;
}

function calculateProgress(kase) {
  const stages = kase.stages;
  if (stages.length === 0) return 0;

  const stageScore =
    stages.reduce((sum, stage) => {
      const own = kase.requirements.filter((r) => r.stageId === stage.id);
      if (stage.status === 'COMPLETED') return sum + 1;
      if (stage.status === 'ACTIVE') return sum + (fulfilment(own) ?? 0.5);
      return sum;
    }, 0) / stages.length;

  const documentScore = fulfilment(kase.requirements);
  const blended = documentScore === null ? stageScore : stageScore * 0.4 + documentScore * 0.6;
  return Math.max(0, Math.min(100, Math.round(blended * 100)));
}

// --- форматирование --------------------------------------------------------

const RELATIVE_UNITS = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

function formatRelative(value) {
  if (!value) return '—';
  const diff = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return 'только что';
}

const formatDate = (value) =>
  value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

const formatDateTime = (value) =>
  value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function plural(count, one, few, many) {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const countOf = (count, one, few, many) => `${count} ${plural(count, one, few, many)}`;

const initials = (name) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

const esc = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isOverdue = (deadline) => Boolean(deadline) && new Date(deadline).getTime() < Date.now();

// --- элементы интерфейса ---------------------------------------------------

const badge = (tone, text) => `<span class="cf-badge cf-badge--${tone}">${esc(text)}</span>`;

const statusBadge = (kind, status) => badge(TONES[kind][status] ?? 'neutral', LABELS[kind][status] ?? status);

function deadlineBadge(deadline, settled = false) {
  if (!deadline || settled) return '';
  const date = new Date(deadline);
  const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const text = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
  if (days < 0) return badge('danger', `Просрочено · ${text}`);
  if (days === 0) return badge('warning', `Сегодня · ${text}`);
  if (days <= 2) return badge('warning', `Через ${days} дн. · ${text}`);
  return badge('neutral', `До ${text}`);
}

const avatar = (name, size = 'md') =>
  `<span class="cf-avatar cf-avatar--${size}">${esc(initials(name))}</span>`;

const progressBar = (value, showLabel = true) => `
  <div class="cf-progress">
    <div class="cf-progress-track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
      <div class="cf-progress-fill" style="width:${value}%"></div>
    </div>
    ${showLabel ? `<span class="cf-progress-label">${value}%</span>` : ''}
  </div>`;
