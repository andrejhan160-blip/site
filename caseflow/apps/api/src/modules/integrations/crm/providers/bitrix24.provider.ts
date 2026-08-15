import { Injectable, Logger } from '@nestjs/common';
import { CrmProviderKind } from '@prisma/client';
import { createHash } from 'node:crypto';
import { safeEqual } from '../../../../common/utils/crypto';
import type {
  CrmConnectionCheck,
  CrmConnectionContext,
  CrmContact,
  CrmEntity,
  CrmProvider,
  CrmWebhookEvent,
  CrmWebhookRequest,
} from '../crm-provider.interface';

interface BitrixResponse<T> {
  result?: T;
  error?: string;
  error_description?: string;
}

const flatten = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const readString = (source: Record<string, unknown>, key: string): string | undefined => {
  const value = source[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
};

/**
 * Bitrix24 adapter built on inbound REST webhooks (no OAuth app required).
 * `credentials.inboundWebhookUrl` looks like:
 *   https://acme.bitrix24.eu/rest/1/abc123token/
 */
@Injectable()
export class Bitrix24Provider implements CrmProvider {
  readonly kind = CrmProviderKind.BITRIX24;
  private readonly logger = new Logger(Bitrix24Provider.name);

  private endpoint(context: CrmConnectionContext, method: string): string {
    const base = context.credentials.inboundWebhookUrl ?? context.baseUrl;
    if (!base) throw new Error('Bitrix24 connection is missing inboundWebhookUrl');
    return `${base.replace(/\/$/, '')}/${method}.json`;
  }

  private async call<T>(
    context: CrmConnectionContext,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T | null> {
    const response = await fetch(this.endpoint(context, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      this.logger.warn(`Bitrix24 ${method} returned HTTP ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as BitrixResponse<T>;
    if (payload.error) {
      this.logger.warn(`Bitrix24 ${method} error: ${payload.error_description ?? payload.error}`);
      return null;
    }
    return payload.result ?? null;
  }

  async connect(context: CrmConnectionContext): Promise<CrmConnectionCheck> {
    try {
      const profile = await this.call<Record<string, unknown>>(context, 'profile', {});
      if (!profile) return { ok: false, detail: 'Битрикс24 отклонил доступы вебхука' };
      return {
        ok: true,
        detail: 'Подключено',
        account: readString(profile, 'NAME') ?? readString(profile, 'ID'),
      };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'Не удалось подключиться' };
    }
  }

  async disconnect(): Promise<void> {
    // Inbound webhooks hold no server-side session; revoking the token in
    // Bitrix24 is an action the administrator performs there.
  }

  async getContact(context: CrmConnectionContext, contactId: string): Promise<CrmContact | null> {
    const result = await this.call<Record<string, unknown>>(context, 'crm.contact.get', { id: contactId });
    if (!result) return null;

    const emails = Array.isArray(result.EMAIL) ? result.EMAIL : [];
    const phones = Array.isArray(result.PHONE) ? result.PHONE : [];

    return {
      id: String(result.ID ?? contactId),
      firstName: readString(result, 'NAME'),
      lastName: readString(result, 'LAST_NAME'),
      email: readString(flatten(emails[0]), 'VALUE'),
      phone: readString(flatten(phones[0]), 'VALUE'),
    };
  }

  async getEntity(context: CrmConnectionContext, entityId: string): Promise<CrmEntity | null> {
    const result = await this.call<Record<string, unknown>>(context, 'crm.deal.get', { id: entityId });
    if (!result) return null;

    return {
      id: String(result.ID ?? entityId),
      title: readString(result, 'TITLE'),
      pipelineId: readString(result, 'CATEGORY_ID') ?? '0',
      stageId: readString(result, 'STAGE_ID'),
      contactId: readString(result, 'CONTACT_ID'),
      responsibleId: readString(result, 'ASSIGNED_BY_ID'),
      customFields: Object.fromEntries(
        Object.entries(result).filter(([key]) => key.startsWith('UF_CRM_')),
      ),
    };
  }

  async syncEntity(
    context: CrmConnectionContext,
    entityId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    await this.call(context, 'crm.deal.update', { id: entityId, fields: patch });
  }

  /**
   * Bitrix posts form-encoded events such as:
   *   event=ONCRMDEALUPDATE&data[FIELDS][ID]=42&ts=1699999999
   *   &auth[application_token]=…&auth[domain]=acme.bitrix24.eu
   */
  handleWebhook(request: CrmWebhookRequest): CrmWebhookEvent | null {
    const body = request.body;
    const eventName = readString(body, 'event');
    if (!eventName) return null;

    const data = flatten(body.data);
    const fields = flatten(data.FIELDS);
    const auth = flatten(body.auth);

    const entityId = readString(fields, 'ID') ?? readString(data, 'ID');
    if (!entityId) return null;

    const entityType = eventName.includes('DEAL')
      ? ('DEAL' as const)
      : eventName.includes('CONTACT')
        ? ('CONTACT' as const)
        : ('UNKNOWN' as const);

    // The idempotency key covers the event, the entity and the delivery
    // timestamp: a retried delivery repeats all three and is skipped, while a
    // genuine later change carries a new timestamp.
    const timestamp = readString(body, 'ts') ?? readString(body, 'event_id') ?? '';
    const digest = createHash('sha256')
      .update(`${eventName}|${entityId}|${timestamp}|${JSON.stringify(fields)}`)
      .digest('hex');

    return {
      idempotencyKey: `bitrix24:${digest}`,
      eventName,
      entityType,
      entityId,
      secret: readString(auth, 'application_token'),
      accountRef: readString(auth, 'domain'),
      raw: body,
    };
  }

  validateWebhook(context: CrmConnectionContext, event: CrmWebhookEvent): boolean {
    if (!context.webhookSecret) return false;
    if (!event.secret) return false;
    return safeEqual(context.webhookSecret, event.secret);
  }
}
