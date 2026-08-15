export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
}

export interface NotificationTemplateContext {
  organizationName: string;
  recipientName: string;
  actionUrl?: string;
  [key: string]: unknown;
}

type TemplateRenderer = (ctx: NotificationTemplateContext) => { subject: string; body: string };

const str = (ctx: NotificationTemplateContext, key: string, fallback = ''): string => {
  const value = ctx[key];
  return typeof value === 'string' ? value : fallback;
};

/**
 * Тексты, не зависящие от канала. Рендерер возвращает обычный текст; каждый
 * канал сам решает, как его показать — письмом, карточкой в приложении, а позже
 * сообщением в Telegram или SMS.
 */
export const NOTIFICATION_TEMPLATES: Record<string, TemplateRenderer> = {
  'auth.magic-link': (ctx) => ({
    subject: `Ссылка для входа — ${ctx.organizationName}`,
    body: `Здравствуйте, ${ctx.recipientName}!\n\nВойдите по ссылке ниже. Она действует ${str(ctx, 'ttlMinutes', '15')} мин. и сработает один раз.\n\n${ctx.actionUrl}\n\nЕсли вы не запрашивали вход — просто не переходите по ссылке.`,
  }),
  'document.requested': (ctx) => ({
    subject: `Нужен документ: ${str(ctx, 'requirementName')}`,
    body: `Здравствуйте, ${ctx.recipientName}!\n\nДля дела «${str(ctx, 'caseTitle')}» компании ${ctx.organizationName} нужен документ «${str(ctx, 'requirementName')}».${str(ctx, 'deadline') ? `\n\nСрок: ${str(ctx, 'deadline')}` : ''}\n\nЗагрузить можно в личном кабинете:\n${ctx.actionUrl}`,
  }),
  'document.uploaded': (ctx) => ({
    subject: `Загружен документ: ${str(ctx, 'filename')}`,
    body: `${str(ctx, 'clientName')} загрузил файл «${str(ctx, 'filename')}» по делу «${str(ctx, 'caseTitle')}». Документ ждёт проверки.\n\n${ctx.actionUrl}`,
  }),
  'document.approved': (ctx) => ({
    subject: `Документ принят: ${str(ctx, 'filename')}`,
    body: `Здравствуйте, ${ctx.recipientName}!\n\nВаш документ «${str(ctx, 'filename')}» принят.\n\n${ctx.actionUrl}`,
  }),
  'document.rejected': (ctx) => ({
    subject: `Нужно загрузить заново: ${str(ctx, 'filename')}`,
    body: `Здравствуйте, ${ctx.recipientName}!\n\nДокумент «${str(ctx, 'filename')}» принять не удалось.\n\nПричина: ${str(ctx, 'rejectionReason')}\n\nЗагрузите, пожалуйста, замену:\n${ctx.actionUrl}`,
  }),
  'request.created': (ctx) => ({
    subject: `Новый запрос: ${str(ctx, 'requestTitle')}`,
    body: `Здравствуйте, ${ctx.recipientName}!\n\nУ компании ${ctx.organizationName} к вам новый запрос: «${str(ctx, 'requestTitle')}».${str(ctx, 'deadline') ? `\n\nСрок: ${str(ctx, 'deadline')}` : ''}\n\n${ctx.actionUrl}`,
  }),
  'request.completed': (ctx) => ({
    subject: `Запрос выполнен: ${str(ctx, 'requestTitle')}`,
    body: `Запрос «${str(ctx, 'requestTitle')}» по делу «${str(ctx, 'caseTitle')}» выполнен.\n\n${ctx.actionUrl}`,
  }),
  'stage.changed': (ctx) => ({
    subject: `Дело перешло на этап «${str(ctx, 'stageName')}»`,
    body: `Здравствуйте, ${ctx.recipientName}!\n\nДело «${str(ctx, 'caseTitle')}» перешло на этап «${str(ctx, 'stageName')}».\n\n${ctx.actionUrl}`,
  }),
  'message.received': (ctx) => ({
    subject: `Новое сообщение по делу «${str(ctx, 'caseTitle')}»`,
    body: `${str(ctx, 'senderName')} пишет:\n\n${str(ctx, 'excerpt')}\n\n${ctx.actionUrl}`,
  }),
  'deadline.approaching': (ctx) => ({
    subject: `Приближается срок: ${str(ctx, 'itemName')}`,
    body: `Здравствуйте, ${ctx.recipientName}!\n\nСрок по «${str(ctx, 'itemName')}» — ${str(ctx, 'deadline')}.\n\n${ctx.actionUrl}`,
  }),
  'deadline.missed': (ctx) => ({
    subject: `Пропущен срок: ${str(ctx, 'itemName')}`,
    body: `Срок по «${str(ctx, 'itemName')}» в деле «${str(ctx, 'caseTitle')}» прошёл ${str(ctx, 'deadline')}.\n\n${ctx.actionUrl}`,
  }),
};

export function renderNotification(templateKey: string, ctx: NotificationTemplateContext): RenderedNotification {
  const renderer = NOTIFICATION_TEMPLATES[templateKey];
  if (!renderer) {
    throw new Error(`Unknown notification template: ${templateKey}`);
  }
  const { subject, body } = renderer(ctx);
  return { subject, text: body, html: toHtml(subject, body, ctx) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toHtml(subject: string, body: string, ctx: NotificationTemplateContext): string {
  const accent = str(ctx, 'primaryColor', '#1F6FEB');
  const paragraphs = body
    .split('\n\n')
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const button = ctx.actionUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(String(ctx.actionUrl))}" style="background:${escapeHtml(accent)};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Открыть CaseFlow</a></p>`
    : '';
  return `<!doctype html><html lang="ru"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;padding:32px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px"><h1 style="font-size:20px;margin:0 0 20px">${escapeHtml(subject)}</h1>${paragraphs}${button}<p style="color:#8a8f98;font-size:12px;margin-top:32px">Отправлено компанией ${escapeHtml(str(ctx, 'organizationName'))} через CaseFlow</p></div></body></html>`;
}
