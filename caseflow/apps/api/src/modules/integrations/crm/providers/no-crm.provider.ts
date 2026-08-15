import { Injectable } from '@nestjs/common';
import { CrmProviderKind } from '@prisma/client';
import type {
  CrmConnectionCheck,
  CrmContact,
  CrmEntity,
  CrmProvider,
  CrmWebhookEvent,
} from '../crm-provider.interface';

/**
 * Explicit "no CRM" adapter. Organizations that do not integrate still resolve a
 * provider, so callers never branch on null.
 */
@Injectable()
export class NoCrmProvider implements CrmProvider {
  readonly kind = CrmProviderKind.NONE;

  async connect(): Promise<CrmConnectionCheck> {
    return { ok: true, detail: 'No CRM integration configured' };
  }

  async disconnect(): Promise<void> {}

  async getContact(): Promise<CrmContact | null> {
    return null;
  }

  async getEntity(): Promise<CrmEntity | null> {
    return null;
  }

  async syncEntity(): Promise<void> {}

  handleWebhook(): CrmWebhookEvent | null {
    return null;
  }

  validateWebhook(): boolean {
    return false;
  }
}
