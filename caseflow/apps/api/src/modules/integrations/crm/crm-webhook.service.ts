import { Injectable, Logger } from '@nestjs/common';
import { ActorType, CrmProviderKind, EventType, Prisma, StageStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CasesService } from '../../cases/cases.service';
import { EventsService } from '../../events/events.service';
import { NotificationService } from '../../notifications/notification.service';
import { CrmProviderRegistry } from './crm-provider.registry';
import type { CrmWebhookEvent, CrmWebhookRequest } from './crm-provider.interface';
import { CrmService } from './crm.service';

export type WebhookOutcome =
  | 'processed'
  | 'duplicate'
  | 'unmatched_case'
  | 'unknown_connection'
  | 'invalid_signature'
  | 'ignored';

export interface WebhookResult {
  outcome: WebhookOutcome;
  caseId?: string;
}

/**
 * Inbound CRM webhook pipeline: validate → identify tenant → deduplicate →
 * apply the change → log → notify. Deliveries are idempotent: the same delivery
 * replayed any number of times produces exactly one event and one notification.
 */
@Injectable()
export class CrmWebhookService {
  private readonly logger = new Logger(CrmWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CrmProviderRegistry,
    private readonly crm: CrmService,
    private readonly cases: CasesService,
    private readonly events: EventsService,
    private readonly notifications: NotificationService,
  ) {}

  async handle(kind: CrmProviderKind, request: CrmWebhookRequest): Promise<WebhookResult> {
    const provider = this.registry.get(kind);
    const event = provider.handleWebhook(request);
    if (!event) return { outcome: 'ignored' };

    // The organization is derived from the secret presented by the caller —
    // never from anything the request claims about itself.
    const connection = await this.prisma.crmConnection.findFirst({
      where: { provider: kind, isActive: true, webhookSecret: event.secret ?? '__none__' },
    });
    if (!connection) {
      this.logger.warn(`Webhook for ${kind} could not be matched to a connection`);
      return { outcome: 'unknown_connection' };
    }

    const context = this.crm.toContext(connection);
    if (!provider.validateWebhook(context, event)) return { outcome: 'invalid_signature' };

    // Claim the delivery before doing any work; the unique constraint makes
    // concurrent duplicates collapse to a single processing run.
    try {
      await this.prisma.webhookDelivery.create({
        data: {
          connectionId: connection.id,
          provider: kind,
          externalKey: event.idempotencyKey,
          status: 'PROCESSING',
          payload: event.raw as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { outcome: 'duplicate' };
      }
      throw error;
    }

    try {
      const result = await this.process(connection.id, connection.organizationId, context, kind, event);
      await this.prisma.webhookDelivery.updateMany({
        where: { connectionId: connection.id, externalKey: event.idempotencyKey },
        data: { status: result.outcome.toUpperCase() },
      });
      await this.prisma.crmConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() },
      });
      return result;
    } catch (error) {
      // Release the claim so the CRM's own retry can be processed.
      await this.prisma.webhookDelivery.deleteMany({
        where: { connectionId: connection.id, externalKey: event.idempotencyKey },
      });
      throw error;
    }
  }

  private async process(
    connectionId: string,
    organizationId: string,
    context: ReturnType<CrmService['toContext']>,
    kind: CrmProviderKind,
    event: CrmWebhookEvent,
  ): Promise<WebhookResult> {
    if (event.entityType !== 'DEAL') return { outcome: 'ignored' };

    const existingCase = await this.prisma.case.findFirst({
      where: { organizationId, externalCrmEntityId: event.entityId },
      include: { currentStage: true, stages: { orderBy: { position: 'asc' } } },
    });
    if (!existingCase) return { outcome: 'unmatched_case' };

    const provider = this.registry.get(kind);
    let entity = null;
    try {
      entity = await provider.getEntity(context, event.entityId);
    } catch (error) {
      this.logger.warn(
        `Could not read ${kind} entity ${event.entityId}: ${error instanceof Error ? error.message : error}`,
      );
    }

    const pipelineId = entity?.pipelineId ?? '0';
    const externalStageId = entity?.stageId;

    const changes: Prisma.CaseUpdateInput = {
      crmProvider: kind,
      crmPipelineId: pipelineId,
      ...(externalStageId ? { crmStageId: externalStageId } : {}),
      ...(entity?.title && entity.title !== existingCase.title ? { title: entity.title } : {}),
    };

    let movedToStageName: string | null = null;

    if (externalStageId) {
      const mapping = await this.prisma.crmStageMapping.findFirst({
        where: { connectionId, pipelineId, externalStageId },
        include: { templateStage: { select: { name: true, position: true } } },
      });

      if (mapping?.templateStage) {
        const targetStage =
          existingCase.stages.find((stage) => stage.name === mapping.templateStage?.name) ??
          existingCase.stages.find((stage) => stage.position === mapping.templateStage?.position);

        if (targetStage && targetStage.id !== existingCase.currentStageId) {
          await this.prisma.$transaction(async (tx) => {
            await tx.caseStage.updateMany({
              where: { caseId: existingCase.id, position: { lt: targetStage.position }, status: { not: StageStatus.COMPLETED } },
              data: { status: StageStatus.COMPLETED, completedAt: new Date() },
            });
            await tx.caseStage.update({
              where: { id: targetStage.id },
              data: { status: StageStatus.ACTIVE, startedAt: targetStage.startedAt ?? new Date(), completedAt: null },
            });
            await tx.case.update({ where: { id: existingCase.id }, data: { currentStageId: targetStage.id } });
          });

          movedToStageName = targetStage.name;

          await this.events.record({
            organizationId,
            caseId: existingCase.id,
            actorType: ActorType.INTEGRATION,
            actorLabel: kind,
            eventType: EventType.STAGE_CHANGED,
            payload: {
              from: existingCase.currentStage?.name ?? null,
              to: targetStage.name,
              source: kind,
              externalStageId,
            },
          });
        }
      }
    }

    await this.prisma.case.update({ where: { id: existingCase.id }, data: changes });

    await this.events.record({
      organizationId,
      caseId: existingCase.id,
      actorType: ActorType.INTEGRATION,
      actorLabel: kind,
      eventType: EventType.CRM_SYNCED,
      payload: {
        event: event.eventName,
        entityId: event.entityId,
        pipelineId,
        externalStageId: externalStageId ?? null,
      },
    });

    await this.cases.recalculateProgress(existingCase.id);

    if (movedToStageName) {
      await this.notifications.notify({
        organizationId,
        clientId: existingCase.clientId,
        templateKey: 'stage.changed',
        link: `/portal/cases/${existingCase.id}`,
        data: { caseTitle: existingCase.title, stageName: movedToStageName },
      });
    }

    return { outcome: 'processed', caseId: existingCase.id };
  }
}
