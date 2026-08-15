import { Injectable, NotFoundException } from '@nestjs/common';
import { CrmProviderKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthContext } from '../../../common/types/auth-context';
import { randomToken } from '../../../common/utils/crypto';
import { CrmProviderRegistry } from './crm-provider.registry';
import type { CrmConnectionContext } from './crm-provider.interface';
import type { ReplaceMappingsInput, UpsertConnectionInput } from './crm.schema';

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CrmProviderRegistry,
  ) {}

  /** Credentials never leave the server; the UI only sees whether they are set. */
  private redact(connection: {
    id: string;
    provider: CrmProviderKind;
    isActive: boolean;
    baseUrl: string | null;
    credentials: Prisma.JsonValue;
    webhookSecret: string | null;
    syncedFields: string[];
    lastSyncedAt: Date | null;
  }) {
    const credentials = (connection.credentials ?? {}) as Record<string, string>;
    return {
      id: connection.id,
      provider: connection.provider,
      isActive: connection.isActive,
      baseUrl: connection.baseUrl,
      configuredKeys: Object.keys(credentials),
      hasCredentials: Object.keys(credentials).length > 0,
      webhookSecret: connection.webhookSecret,
      syncedFields: connection.syncedFields,
      lastSyncedAt: connection.lastSyncedAt,
    };
  }

  async getSettings(auth: AuthContext) {
    const connections = await this.prisma.crmConnection.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        mappings: {
          orderBy: [{ pipelineId: 'asc' }, { externalStageId: 'asc' }],
          include: {
            templateStage: {
              select: { id: true, name: true, template: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    return {
      availableProviders: this.registry.list(),
      connections: connections.map((connection) => ({
        ...this.redact(connection),
        mappings: connection.mappings,
      })),
    };
  }

  async upsertConnection(auth: AuthContext, input: UpsertConnectionInput) {
    const existing = await this.prisma.crmConnection.findFirst({
      where: { organizationId: auth.organizationId, provider: input.provider },
    });

    const connection = existing
      ? await this.prisma.crmConnection.update({
          where: { id: existing.id },
          data: {
            isActive: input.isActive,
            baseUrl: input.baseUrl,
            credentials: {
              ...((existing.credentials as Record<string, string>) ?? {}),
              ...input.credentials,
            },
            syncedFields: input.syncedFields,
          },
        })
      : await this.prisma.crmConnection.create({
          data: {
            organizationId: auth.organizationId,
            provider: input.provider,
            isActive: input.isActive,
            baseUrl: input.baseUrl,
            credentials: input.credentials,
            syncedFields: input.syncedFields,
            // Shared with Bitrix as the application token; inbound deliveries
            // are matched to this organization by this value alone.
            webhookSecret: randomToken(24),
          },
        });

    return this.redact(connection);
  }

  async testConnection(auth: AuthContext, connectionId: string) {
    const connection = await this.requireConnection(auth.organizationId, connectionId);
    const provider = this.registry.get(connection.provider);
    const result = await provider.connect(this.toContext(connection));
    if (result.ok) {
      await this.prisma.crmConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() },
      });
    }
    return result;
  }

  async disconnect(auth: AuthContext, connectionId: string) {
    const connection = await this.requireConnection(auth.organizationId, connectionId);
    const provider = this.registry.get(connection.provider);
    await provider.disconnect(this.toContext(connection));
    const updated = await this.prisma.crmConnection.update({
      where: { id: connection.id },
      data: { isActive: false },
    });
    return this.redact(updated);
  }

  async replaceMappings(auth: AuthContext, connectionId: string, input: ReplaceMappingsInput) {
    const connection = await this.requireConnection(auth.organizationId, connectionId);

    const templateStageIds = input.mappings
      .map((mapping) => mapping.templateStageId)
      .filter((id): id is string => Boolean(id));

    if (templateStageIds.length > 0) {
      const owned = await this.prisma.workflowTemplateStage.count({
        where: { id: { in: templateStageIds }, template: { organizationId: auth.organizationId } },
      });
      if (owned !== new Set(templateStageIds).size) {
        throw new NotFoundException('One or more workflow stages do not belong to your organization');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.crmStageMapping.deleteMany({ where: { connectionId: connection.id } });
      for (const mapping of input.mappings) {
        await tx.crmStageMapping.create({ data: { connectionId: connection.id, ...mapping } });
      }
    });

    return this.getSettings(auth);
  }

  async requireConnection(organizationId: string, connectionId: string) {
    const connection = await this.prisma.crmConnection.findFirst({
      where: { id: connectionId, organizationId },
    });
    if (!connection) throw new NotFoundException('CRM connection not found');
    return connection;
  }

  toContext(connection: {
    id: string;
    organizationId: string;
    baseUrl: string | null;
    credentials: Prisma.JsonValue;
    webhookSecret: string | null;
  }): CrmConnectionContext {
    return {
      connectionId: connection.id,
      organizationId: connection.organizationId,
      baseUrl: connection.baseUrl,
      credentials: (connection.credentials as Record<string, string>) ?? {},
      webhookSecret: connection.webhookSecret,
    };
  }
}
