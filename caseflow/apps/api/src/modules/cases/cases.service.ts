import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActorType,
  CaseStatus,
  EventType,
  Prisma,
  RequestStatus,
  RequirementStatus,
  Role,
  StageStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { paginate, skipTake, type Paginated } from '../../common/utils/pagination';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';
import { CaseAccessService } from './case-access.service';
import { calculateProgress } from './case-progress';
import type { ChangeStageInput, CreateCaseInput, ListCasesQuery, UpdateCaseInput } from './cases.schema';

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
    private readonly events: EventsService,
    private readonly notifications: NotificationService,
  ) {}

  async list(auth: AuthContext, query: ListCasesQuery): Promise<Paginated<unknown>> {
    const now = new Date();
    const where: Prisma.CaseWhereInput = {
      ...this.access.scope(auth),
      ...(query.status ? { status: query.status } : {}),
      ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.workflowTemplateId ? { workflowTemplateId: query.workflowTemplateId } : {}),
      ...(query.stageName ? { currentStage: { name: query.stageName } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { externalCrmEntityId: { contains: query.search, mode: 'insensitive' } },
              { client: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { client: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { client: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.overdue
        ? {
            OR: [
              { requirements: { some: { deadline: { lt: now }, status: { in: [RequirementStatus.PENDING, RequirementStatus.REJECTED] } } } },
              { requests: { some: { deadline: { lt: now }, status: { in: [RequestStatus.OPEN, RequestStatus.OVERDUE] } } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        ...skipTake(query),
        orderBy: { lastActivityAt: 'desc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedUser: { select: { id: true, name: true, avatarUrl: true } },
          currentStage: { select: { id: true, name: true, position: true } },
          template: { select: { id: true, name: true } },
          _count: { select: { stages: true } },
        },
      }),
      this.prisma.case.count({ where }),
    ]);

    return paginate(rows, total, query);
  }

  async get(auth: AuthContext, caseId: string) {
    await this.access.assertAccess(auth, caseId);

    const record = await this.prisma.case.findFirstOrThrow({
      where: { id: caseId, organizationId: auth.organizationId },
      include: {
        client: true,
        assignedUser: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        template: { select: { id: true, name: true } },
        currentStage: true,
        stages: {
          orderBy: { position: 'asc' },
          include: {
            requirements: {
              orderBy: { createdAt: 'asc' },
              include: {
                documents: { orderBy: { version: 'desc' }, take: 1 },
              },
            },
          },
        },
        requirements: {
          orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
          include: {
            stage: { select: { id: true, name: true } },
            documents: {
              orderBy: { version: 'desc' },
              include: { uploadedBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } } },
            },
          },
        },
        requests: { orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { id: true, name: true } } } },
        tasks: { orderBy: { createdAt: 'desc' }, include: { assignedTo: { select: { id: true, name: true } } } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } } },
        },
      },
    });

    const activity = await this.events.listForCase(auth.organizationId, caseId, 100);

    // Clients never see internal-only tasks.
    const tasks =
      auth.role === Role.CLIENT
        ? record.tasks.filter((task) => task.visibility !== 'INTERNAL')
        : record.tasks;

    return { ...record, tasks, activity };
  }

  /**
   * Instantiates a case from a workflow template by copying its stages and
   * requirements. The copy is independent: later template edits never reach
   * cases that were already created.
   */
  async create(auth: AuthContext, input: CreateCaseInput) {
    this.access.assertStaff(auth);

    const [client, template] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: input.clientId, organizationId: auth.organizationId } }),
      this.prisma.workflowTemplate.findFirst({
        where: { id: input.workflowTemplateId, organizationId: auth.organizationId },
        include: { stages: { orderBy: { position: 'asc' }, include: { requirements: { orderBy: { position: 'asc' } } } } },
      }),
    ]);

    if (!client) throw new NotFoundException('Клиент не найден');
    if (!template) throw new NotFoundException('Воркфлоу не найден');
    if (template.stages.length === 0) {
      throw new BadRequestException('В этом воркфлоу нет этапов');
    }

    if (input.assignedUserId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: input.assignedUserId, organizationId: auth.organizationId, role: { not: Role.CLIENT } },
      });
      if (!assignee) throw new BadRequestException('Сотрудник не найден');
    }

    const startDate = input.startDate ?? new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const newCase = await tx.case.create({
        data: {
          organizationId: auth.organizationId,
          clientId: client.id,
          assignedUserId: input.assignedUserId ?? auth.userId,
          workflowTemplateId: template.id,
          title: input.title ?? template.name,
          description: input.description,
          status: CaseStatus.ACTIVE,
          externalCrmEntityId: input.externalCrmEntityId,
        },
      });

      let firstStageId: string | null = null;

      for (const templateStage of template.stages) {
        const stage = await tx.caseStage.create({
          data: {
            caseId: newCase.id,
            name: templateStage.name,
            description: templateStage.description,
            position: templateStage.position,
            status: templateStage.position === 0 ? StageStatus.ACTIVE : StageStatus.PENDING,
            startedAt: templateStage.position === 0 ? new Date() : null,
          },
        });
        if (templateStage.position === 0) firstStageId = stage.id;

        for (const requirement of templateStage.requirements) {
          await tx.documentRequirement.create({
            data: {
              caseId: newCase.id,
              stageId: stage.id,
              name: requirement.name,
              description: requirement.description,
              instructions: requirement.instructions,
              required: requirement.required,
              deadline:
                requirement.deadlineDays === null
                  ? null
                  : new Date(startDate.getTime() + requirement.deadlineDays * 24 * 60 * 60 * 1000),
            },
          });
        }
      }

      const withStage = await tx.case.update({
        where: { id: newCase.id },
        data: { currentStageId: firstStageId },
      });

      await this.events.recordAs(
        auth,
        {
          caseId: newCase.id,
          eventType: EventType.CASE_CREATED,
          payload: { title: withStage.title, templateName: template.name },
        },
        tx,
      );

      return withStage;
    });

    await this.recalculateProgress(created.id);
    return this.get(auth, created.id);
  }

  async update(auth: AuthContext, caseId: string, input: UpdateCaseInput) {
    this.access.assertStaff(auth);
    const existing = await this.access.assertAccess(auth, caseId);

    if (input.assignedUserId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: input.assignedUserId, organizationId: auth.organizationId, role: { not: Role.CLIENT } },
      });
      if (!assignee) throw new BadRequestException('Сотрудник не найден');
    }

    const updated = await this.prisma.case.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        assignedUserId: input.assignedUserId,
      },
    });

    await this.events.recordAs(auth, {
      caseId,
      eventType: input.status ? EventType.CASE_STATUS_CHANGED : EventType.CASE_UPDATED,
      payload: { changes: input as Prisma.InputJsonValue },
    });

    if (input.assignedUserId && input.assignedUserId !== existing.assignedUserId) {
      await this.notifications.notify({
        organizationId: auth.organizationId,
        userId: input.assignedUserId,
        templateKey: 'stage.changed',
        link: `/cases/${caseId}`,
        data: { caseTitle: updated.title, stageName: 'assigned to you' },
      });
    }

    return this.get(auth, caseId);
  }

  /** Moves the case to another stage of its own (copied) workflow. */
  async changeStage(auth: AuthContext, caseId: string, input: ChangeStageInput) {
    this.access.assertStaff(auth);
    await this.access.assertAccess(auth, caseId);

    const target = await this.prisma.caseStage.findFirst({ where: { id: input.stageId, caseId } });
    if (!target) throw new NotFoundException('У этого дела нет такого этапа');

    const stages = await this.prisma.caseStage.findMany({ where: { caseId }, orderBy: { position: 'asc' } });
    const previous = stages.find((stage) => stage.status === StageStatus.ACTIVE);

    await this.prisma.$transaction(async (tx) => {
      if (input.completePrevious) {
        await tx.caseStage.updateMany({
          where: { caseId, position: { lt: target.position }, status: { not: StageStatus.COMPLETED } },
          data: { status: StageStatus.COMPLETED, completedAt: new Date() },
        });
      }

      await tx.caseStage.updateMany({
        where: { caseId, position: { gt: target.position }, status: { not: StageStatus.PENDING } },
        data: { status: StageStatus.PENDING, completedAt: null },
      });

      await tx.caseStage.update({
        where: { id: target.id },
        data: {
          status: StageStatus.ACTIVE,
          startedAt: target.startedAt ?? new Date(),
          completedAt: null,
        },
      });

      await tx.case.update({ where: { id: caseId }, data: { currentStageId: target.id } });

      await this.events.recordAs(
        auth,
        {
          caseId,
          eventType: EventType.STAGE_CHANGED,
          payload: { from: previous?.name ?? null, to: target.name, note: input.note ?? null },
        },
        tx,
      );
    });

    await this.recalculateProgress(caseId);

    const record = await this.prisma.case.findFirstOrThrow({
      where: { id: caseId },
      select: { title: true, clientId: true },
    });
    await this.notifications.notify({
      organizationId: auth.organizationId,
      clientId: record.clientId,
      templateKey: 'stage.changed',
      link: `/portal/cases/${caseId}`,
      data: { caseTitle: record.title, stageName: target.name },
    });

    return this.get(auth, caseId);
  }

  /**
   * Recomputes and stores the case progress. Called after any change that can
   * move the number so reads stay cheap.
   */
  async recalculateProgress(caseId: string): Promise<number> {
    const stages = await this.prisma.caseStage.findMany({
      where: { caseId },
      select: { status: true, requirements: { select: { status: true, required: true } } },
    });

    // Requirements added outside a stage still count towards the document score.
    const unassigned = await this.prisma.documentRequirement.findMany({
      where: { caseId, stageId: null },
      select: { status: true, required: true },
    });

    const progress = calculateProgress(stages, unassigned);
    await this.prisma.case.update({ where: { id: caseId }, data: { progress } });
    return progress;
  }

  async recordSystemEvent(
    organizationId: string,
    caseId: string,
    eventType: EventType,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.events.record({
      organizationId,
      caseId,
      actorType: ActorType.SYSTEM,
      actorLabel: 'CaseFlow',
      eventType,
      payload,
    });
  }
}
