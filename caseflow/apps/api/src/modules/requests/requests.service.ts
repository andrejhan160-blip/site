import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventType, RequestStatus, RequirementStatus, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CaseAccessService } from '../cases/case-access.service';
import type { CreateRequestInput } from '../cases/cases.schema';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
    private readonly events: EventsService,
    private readonly notifications: NotificationService,
  ) {}

  async create(auth: AuthContext, caseId: string, input: CreateRequestInput) {
    this.access.assertStaff(auth);
    const target = await this.access.assertAccess(auth, caseId);

    const request = await this.prisma.clientRequest.create({
      data: {
        organizationId: auth.organizationId,
        caseId,
        clientId: target.clientId,
        type: input.type,
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        status: RequestStatus.OPEN,
        createdById: auth.userId,
      },
    });

    await this.events.recordAs(auth, {
      caseId,
      eventType: EventType.REQUEST_CREATED,
      payload: { requestId: request.id, title: request.title, type: request.type },
    });

    if (input.notifyClient) {
      await this.notifications.notify({
        organizationId: auth.organizationId,
        clientId: target.clientId,
        templateKey: 'request.created',
        link: '/portal/requests',
        data: {
          requestTitle: request.title,
          caseTitle: target.title,
          deadline: request.deadline ? request.deadline.toISOString().slice(0, 10) : '',
        },
      });
    }

    return request;
  }

  /** Marks a request complete. Both staff and the owning client may do this. */
  async complete(auth: AuthContext, requestId: string) {
    const request = await this.prisma.clientRequest.findFirst({
      where: { id: requestId, organizationId: auth.organizationId },
      include: { case: { select: { id: true, title: true, assignedUserId: true } } },
    });
    if (!request) throw new NotFoundException('Запрос не найден');
    await this.access.assertAccess(auth, request.caseId);

    if (request.requirementId) {
      const requirement = await this.prisma.documentRequirement.findUnique({
        where: { id: request.requirementId },
        select: { status: true },
      });
      if (requirement && requirement.status !== RequirementStatus.APPROVED) {
        throw new ForbiddenException('Чтобы закрыть запрос, загрузите документ и дождитесь его приёмки');
      }
    }

    const updated = await this.prisma.clientRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.COMPLETED, completedAt: new Date() },
    });

    await this.events.recordAs(auth, {
      caseId: request.caseId,
      eventType: EventType.REQUEST_COMPLETED,
      payload: { requestId: request.id, title: request.title },
    });

    if (request.case.assignedUserId && auth.role === Role.CLIENT) {
      await this.notifications.notify({
        organizationId: auth.organizationId,
        userId: request.case.assignedUserId,
        templateKey: 'request.completed',
        link: `/cases/${request.caseId}?tab=requests`,
        data: { requestTitle: request.title, caseTitle: request.case.title },
      });
    }

    return updated;
  }

  async cancel(auth: AuthContext, requestId: string) {
    this.access.assertStaff(auth);
    const request = await this.prisma.clientRequest.findFirst({
      where: { id: requestId, organizationId: auth.organizationId },
    });
    if (!request) throw new NotFoundException('Запрос не найден');
    await this.access.assertAccess(auth, request.caseId);

    const updated = await this.prisma.clientRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.CANCELLED },
    });

    await this.events.recordAs(auth, {
      caseId: request.caseId,
      eventType: EventType.REQUEST_CANCELLED,
      payload: { requestId: request.id, title: request.title },
    });

    return updated;
  }

  async listForClient(auth: AuthContext) {
    if (auth.role !== Role.CLIENT || !auth.clientId) throw new ForbiddenException('Только для кабинета клиента');
    return this.prisma.clientRequest.findMany({
      where: { organizationId: auth.organizationId, clientId: auth.clientId },
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
      include: {
        case: { select: { id: true, title: true } },
        requirement: { select: { id: true, name: true, status: true } },
      },
    });
  }
}
