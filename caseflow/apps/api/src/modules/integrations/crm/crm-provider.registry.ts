import { Injectable, NotFoundException } from '@nestjs/common';
import { CrmProviderKind } from '@prisma/client';
import type { CrmProvider } from './crm-provider.interface';
import { Bitrix24Provider } from './providers/bitrix24.provider';
import { NoCrmProvider } from './providers/no-crm.provider';

/**
 * Resolves a provider implementation by kind. Registering AmoCRMProvider later
 * is a one-line change here plus the adapter itself.
 */
@Injectable()
export class CrmProviderRegistry {
  private readonly providers = new Map<CrmProviderKind, CrmProvider>();

  constructor(bitrix: Bitrix24Provider, none: NoCrmProvider) {
    this.providers.set(bitrix.kind, bitrix);
    this.providers.set(none.kind, none);
  }

  get(kind: CrmProviderKind): CrmProvider {
    const provider = this.providers.get(kind);
    if (!provider) throw new NotFoundException(`CRM provider ${kind} is not available`);
    return provider;
  }

  list(): CrmProviderKind[] {
    return [...this.providers.keys()];
  }
}
