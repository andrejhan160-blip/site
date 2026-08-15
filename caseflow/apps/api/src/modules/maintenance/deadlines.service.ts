import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActorType, EventType, RequestStatus, RequirementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';
import { JobRegistry } from '../queue/job-registry.service';

export const DEADLINE_SCAN_JOB = 'deadline.scan';

/**
 * Marks passed deadlines and raises DEADLINE_MISSED once per item. The scan is
 * safe to run repeatedly: an item that already produced its event is skipped.
 */
@Injectable()
export class DeadlinesService implements OnModuleInit {
  private readonly logger = new Logger(DeadlinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationService,
    private readonly registry: JobRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(DEADLINE_SCAN_JOB, async () => {
      await this.scan();
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledScan(): Promise<void> {
    await this.scan();
  }


  async scan(): Promise<{ requests: number; requirements: number }> {
    const now = new Date();

    const overdueRequests = await this.prisma.clientRequest.findMany({
      where: { status: RequestStatus.OPEN, deadline: { lt: now } },
      include: { case: { select: { id: true, title: true, assignedUserId: true } } },
      take: 500,
    });

    for (const request of overdueRequests) {
      await this.prisma.clientRequest.update({
        where: { id: request.id },
        data: { status: RequestStatus.OVERDUE },
      });
      await this.events.record({
        organizationId: request.organizationId,
        caseId: request.caseId,
        actorType: ActorType.SYSTEM,
        actorLabel: 'CaseFlow',
        eventType: EventType.DEADLINE_MISSED,
        payload: {
          kind: 'REQUEST',
          requestId: request.id,
          title: request.title,
          deadline: request.deadline?.toISOString() ?? null,
        },
      });
      if (request.case.assignedUserId) {
        await this.notifications.notify({
          organizationId: request.organizationId,
          userId: request.case.assignedUserId,
          templateKey: 'deadline.missed',
          link: `/cases/${request.caseId}?tab=requests`,
          data: {
            itemName: request.title,
            caseTitle: request.case.title,
            deadline: request.deadline?.toISOString().slice(0, 10) ?? '',
          },
        });
      }
    }

    const overdueRequirements = await this.prisma.documentRequirement.findMany({
      where: {
        deadline: { lt: now },
        status: { in: [RequirementStatus.PENDING, RequirementStatus.REJECTED] },
      },
      include: { case: { select: { id: true, title: true, organizationId: true, assignedUserId: true } } },
      take: 500,
    });

    let requirementsFlagged = 0;
    for (const requirement of overdueRequirements) {
      const alreadyLogged = await this.prisma.event.findFirst({
        where: {
          caseId: requirement.caseId,
          eventType: EventType.DEADLINE_MISSED,
          payload: { path: ['requirementId'], equals: requirement.id },
        },
      });
      if (alreadyLogged) continue;

      await this.events.record({
        organizationId: requirement.case.organizationId,
        caseId: requirement.caseId,
        actorType: ActorType.SYSTEM,
        actorLabel: 'CaseFlow',
        eventType: EventType.DEADLINE_MISSED,
        payload: {
          kind: 'DOCUMENT',
          requirementId: requirement.id,
          title: requirement.name,
          deadline: requirement.deadline?.toISOString() ?? null,
        },
      });
      requirementsFlagged += 1;

      if (requirement.case.assignedUserId) {
        await this.notifications.notify({
          organizationId: requirement.case.organizationId,
          userId: requirement.case.assignedUserId,
          templateKey: 'deadline.missed',
          link: `/cases/${requirement.caseId}?tab=documents`,
          data: {
            itemName: requirement.name,
            caseTitle: requirement.case.title,
            deadline: requirement.deadline?.toISOString().slice(0, 10) ?? '',
          },
        });
      }
    }

    if (overdueRequests.length || requirementsFlagged) {
      this.logger.log(
        `Deadline scan: ${overdueRequests.length} requests marked overdue, ${requirementsFlagged} documents flagged`,
      );
    }

    return { requests: overdueRequests.length, requirements: requirementsFlagged };
  }
}
