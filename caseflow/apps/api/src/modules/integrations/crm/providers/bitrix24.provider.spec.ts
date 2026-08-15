import type { CrmConnectionContext, CrmWebhookRequest } from '../crm-provider.interface';
import { Bitrix24Provider } from './bitrix24.provider';

const request = (body: Record<string, unknown>): CrmWebhookRequest => ({ headers: {}, body });

const deliveryBody = (overrides: Record<string, unknown> = {}) => ({
  event: 'ONCRMDEALUPDATE',
  data: { FIELDS: { ID: '4021' } },
  ts: '1730000000',
  auth: { application_token: 'secret-token', domain: 'acme.bitrix24.eu' },
  ...overrides,
});

describe('Bitrix24Provider webhooks', () => {
  const provider = new Bitrix24Provider();

  it('normalises a deal update delivery', () => {
    const event = provider.handleWebhook(request(deliveryBody()));
    expect(event).toMatchObject({
      eventName: 'ONCRMDEALUPDATE',
      entityType: 'DEAL',
      entityId: '4021',
      secret: 'secret-token',
      accountRef: 'acme.bitrix24.eu',
    });
  });

  it('produces the same idempotency key for a repeated delivery', () => {
    const first = provider.handleWebhook(request(deliveryBody()));
    const retry = provider.handleWebhook(request(deliveryBody()));
    expect(first?.idempotencyKey).toBe(retry?.idempotencyKey);
  });

  it('produces a different key for a later change to the same deal', () => {
    const first = provider.handleWebhook(request(deliveryBody()));
    const later = provider.handleWebhook(request(deliveryBody({ ts: '1730000900' })));
    expect(first?.idempotencyKey).not.toBe(later?.idempotencyKey);
  });

  it('ignores payloads without an event or entity id', () => {
    expect(provider.handleWebhook(request({ data: { FIELDS: { ID: '1' } } }))).toBeNull();
    expect(provider.handleWebhook(request({ event: 'ONCRMDEALUPDATE', data: {} }))).toBeNull();
  });

  it('accepts only the application token stored on the connection', () => {
    const event = provider.handleWebhook(request(deliveryBody()));
    const context = (secret: string | null): CrmConnectionContext => ({
      connectionId: 'conn-1',
      organizationId: 'org-1',
      credentials: {},
      webhookSecret: secret,
    });

    expect(provider.validateWebhook(context('secret-token'), event!)).toBe(true);
    expect(provider.validateWebhook(context('other-token'), event!)).toBe(false);
    expect(provider.validateWebhook(context(null), event!)).toBe(false);
  });
});
