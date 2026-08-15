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
 * Channel-agnostic copy. Renderers return plain text; each channel decides how
 * to present it (email body, in-app card, and later Telegram/SMS).
 */
export const NOTIFICATION_TEMPLATES: Record<string, TemplateRenderer> = {
  'auth.magic-link': (ctx) => ({
    subject: `Your ${ctx.organizationName} sign-in link`,
    body: `Hi ${ctx.recipientName},\n\nUse the link below to sign in. It expires in ${str(ctx, 'ttlMinutes', '15')} minutes and can be used once.\n\n${ctx.actionUrl}\n\nIf you did not request this, you can ignore this email.`,
  }),
  'document.requested': (ctx) => ({
    subject: `New document request: ${str(ctx, 'requirementName')}`,
    body: `Hi ${ctx.recipientName},\n\n${ctx.organizationName} needs "${str(ctx, 'requirementName')}" for your case "${str(ctx, 'caseTitle')}".${str(ctx, 'deadline') ? `\n\nDeadline: ${str(ctx, 'deadline')}` : ''}\n\nOpen your portal to upload it:\n${ctx.actionUrl}`,
  }),
  'document.uploaded': (ctx) => ({
    subject: `Document uploaded: ${str(ctx, 'filename')}`,
    body: `${str(ctx, 'clientName')} uploaded "${str(ctx, 'filename')}" for case "${str(ctx, 'caseTitle')}". It is waiting for review.\n\n${ctx.actionUrl}`,
  }),
  'document.approved': (ctx) => ({
    subject: `Document approved: ${str(ctx, 'filename')}`,
    body: `Hi ${ctx.recipientName},\n\nYour document "${str(ctx, 'filename')}" was approved.\n\n${ctx.actionUrl}`,
  }),
  'document.rejected': (ctx) => ({
    subject: `Document needs to be re-uploaded: ${str(ctx, 'filename')}`,
    body: `Hi ${ctx.recipientName},\n\nYour document "${str(ctx, 'filename')}" could not be accepted.\n\nReason: ${str(ctx, 'rejectionReason')}\n\nPlease upload a replacement:\n${ctx.actionUrl}`,
  }),
  'request.created': (ctx) => ({
    subject: `New request: ${str(ctx, 'requestTitle')}`,
    body: `Hi ${ctx.recipientName},\n\n${ctx.organizationName} has a new request for you: "${str(ctx, 'requestTitle')}".${str(ctx, 'deadline') ? `\n\nDeadline: ${str(ctx, 'deadline')}` : ''}\n\n${ctx.actionUrl}`,
  }),
  'request.completed': (ctx) => ({
    subject: `Request completed: ${str(ctx, 'requestTitle')}`,
    body: `"${str(ctx, 'requestTitle')}" was completed for case "${str(ctx, 'caseTitle')}".\n\n${ctx.actionUrl}`,
  }),
  'stage.changed': (ctx) => ({
    subject: `Your case moved to ${str(ctx, 'stageName')}`,
    body: `Hi ${ctx.recipientName},\n\nCase "${str(ctx, 'caseTitle')}" moved to stage "${str(ctx, 'stageName')}".\n\n${ctx.actionUrl}`,
  }),
  'message.received': (ctx) => ({
    subject: `New message about ${str(ctx, 'caseTitle')}`,
    body: `${str(ctx, 'senderName')} wrote:\n\n${str(ctx, 'excerpt')}\n\n${ctx.actionUrl}`,
  }),
  'deadline.approaching': (ctx) => ({
    subject: `Deadline approaching: ${str(ctx, 'itemName')}`,
    body: `Hi ${ctx.recipientName},\n\n"${str(ctx, 'itemName')}" is due ${str(ctx, 'deadline')}.\n\n${ctx.actionUrl}`,
  }),
  'deadline.missed': (ctx) => ({
    subject: `Deadline missed: ${str(ctx, 'itemName')}`,
    body: `"${str(ctx, 'itemName')}" on case "${str(ctx, 'caseTitle')}" passed its deadline on ${str(ctx, 'deadline')}.\n\n${ctx.actionUrl}`,
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
    ? `<p style="margin:24px 0"><a href="${escapeHtml(String(ctx.actionUrl))}" style="background:${escapeHtml(accent)};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Open CaseFlow</a></p>`
    : '';
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;padding:32px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px"><h1 style="font-size:20px;margin:0 0 20px">${escapeHtml(subject)}</h1>${paragraphs}${button}<p style="color:#8a8f98;font-size:12px;margin-top:32px">Sent by ${escapeHtml(str(ctx, 'organizationName'))} via CaseFlow</p></div></body></html>`;
}
