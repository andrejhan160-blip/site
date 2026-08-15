import type { CrmProviderKind } from '@prisma/client';

export interface CrmCredentials {
  [key: string]: string | undefined;
}

export interface CrmConnectionContext {
  connectionId: string;
  organizationId: string;
  baseUrl?: string | null;
  credentials: CrmCredentials;
  webhookSecret?: string | null;
}

export interface CrmContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface CrmEntity {
  id: string;
  title?: string;
  pipelineId?: string;
  stageId?: string;
  stageName?: string;
  contactId?: string;
  responsibleId?: string;
  responsibleEmail?: string;
  customFields?: Record<string, unknown>;
}

export interface CrmWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  rawBody?: Buffer;
}

export interface CrmWebhookEvent {
  /** Stable id for the delivery; repeated deliveries must produce the same key. */
  idempotencyKey: string;
  eventName: string;
  entityType: 'DEAL' | 'CONTACT' | 'UNKNOWN';
  entityId: string;
  /** Token/secret presented by the caller, checked against the connection. */
  secret?: string;
  /** Sender domain/account, used to disambiguate multiple connections. */
  accountRef?: string;
  raw: Record<string, unknown>;
}

export interface CrmConnectionCheck {
  ok: boolean;
  detail: string;
  account?: string;
}

/**
 * Contract every CRM adapter implements. Business modules depend on this
 * interface only; Bitrix24 today, amoCRM or a no-op provider tomorrow.
 */
export interface CrmProvider {
  readonly kind: CrmProviderKind;

  connect(context: CrmConnectionContext): Promise<CrmConnectionCheck>;
  disconnect(context: CrmConnectionContext): Promise<void>;

  getContact(context: CrmConnectionContext, contactId: string): Promise<CrmContact | null>;
  getEntity(context: CrmConnectionContext, entityId: string): Promise<CrmEntity | null>;

  /** Pushes CaseFlow state back to the CRM (stage, status, links). */
  syncEntity(context: CrmConnectionContext, entityId: string, patch: Record<string, unknown>): Promise<void>;

  /** Parses a raw HTTP request into a normalised event. */
  handleWebhook(request: CrmWebhookRequest): CrmWebhookEvent | null;

  /** Verifies the delivery actually came from the connected account. */
  validateWebhook(context: CrmConnectionContext, event: CrmWebhookEvent): boolean;
}

export const CRM_PROVIDERS = Symbol('CRM_PROVIDERS');
