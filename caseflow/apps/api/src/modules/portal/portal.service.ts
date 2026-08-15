import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, RequestStatus, RequirementStatus, Role, TaskStatus, TaskVisibility } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CasesService } from '../cases/cases.service';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Read models for the client portal. Every query is bound to the authenticated
 * client's own id — the portal never accepts a client id from the request.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cases: CasesService,
  ) {}

  private clientId(auth: AuthContext): string {
    if (auth.role !== Role.CLIENT || !auth.clientId) {
      throw new ForbiddenException('This area is only available to client accounts');
    }
    return auth.clientId;
  }

  async dashboard(auth: AuthContext) {
    const clientId = this.clientId(auth);
    const now = new Date();
    const soon = new Date(now.getTime() + 14 * DAY);

    const [organization, client, cases, openRequests, tasks, activity] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: auth.organizationId },
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          supportEmail: true,
          portalWelcomeText: true,
        },
      }),
      this.prisma.client.findFirstOrThrow({
        where: { id: clientId, organizationId: auth.organizationId },
        select: { firstName: true, lastName: true, email: true },
      }),
      this.prisma.case.findMany({
        where: { organizationId: auth.organizationId, clientId },
        orderBy: { lastActivityAt: 'desc' },
        include: {
          currentStage: true,
          assignedUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
          stages: { orderBy: { position: 'asc' } },
        },
      }),
      this.prisma.clientRequest.findMany({
        where: {
          organizationId: auth.organizationId,
          clientId,
          status: { in: [RequestStatus.OPEN, RequestStatus.OVERDUE] },
        },
        orderBy: [{ deadline: 'asc' }],
        include: { case: { select: { id: true, title: true } }, requirement: { select: { id: true, name: true, status: true } } },
      }),
      this.prisma.task.findMany({
        where: {
          organizationId: auth.organizationId,
          case: { clientId },
          visibility: { in: [TaskVisibility.CLIENT, TaskVisibility.BOTH] },
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
        },
        orderBy: { deadline: 'asc' },
        include: { case: { select: { id: true, title: true } } },
      }),
      this.prisma.event.findMany({
        where: { organizationId: auth.organizationId, case: { clientId } },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { case: { select: { id: true, title: true } } },
      }),
    ]);

    const activeCase = cases.find((item) => item.status === CaseStatus.ACTIVE) ?? cases[0] ?? null;

    const deadlines = await this.prisma.documentRequirement.findMany({
      where: {
        case: { organizationId: auth.organizationId, clientId },
        status: { in: [RequirementStatus.PENDING, RequirementStatus.REJECTED] },
        deadline: { gte: now, lte: soon },
      },
      orderBy: { deadline: 'asc' },
      include: { case: { select: { id: true, title: true } } },
    });

    const nextStage = activeCase
      ? (activeCase.stages.find(
          (stage) => stage.position === (activeCase.currentStage?.position ?? -1) + 1,
        ) ?? null)
      : null;

    return {
      organization,
      client,
      activeCase,
      nextStage,
      cases,
      openRequests,
      tasks,
      deadlines,
      activity,
    };
  }

  async case(auth: AuthContext, caseId: string) {
    this.clientId(auth);
    return this.cases.get(auth, caseId);
  }

  async documents(auth: AuthContext) {
    const clientId = this.clientId(auth);
    const requirements = await this.prisma.documentRequirement.findMany({
      where: { case: { organizationId: auth.organizationId, clientId } },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      include: {
        case: { select: { id: true, title: true } },
        stage: { select: { id: true, name: true } },
        documents: {
          orderBy: { version: 'desc' },
          include: { reviewedBy: { select: { name: true } } },
        },
      },
    });

    const inGroup = (statuses: RequirementStatus[], status: RequirementStatus) => statuses.includes(status);

    return {
      required: requirements.filter((item) =>
        inGroup([RequirementStatus.PENDING, RequirementStatus.REJECTED], item.status),
      ),
      underReview: requirements.filter((item) =>
        inGroup([RequirementStatus.UNDER_REVIEW, RequirementStatus.UPLOADED], item.status),
      ),
      approved: requirements.filter((item) =>
        inGroup([RequirementStatus.APPROVED, RequirementStatus.WAIVED], item.status),
      ),
      rejected: requirements.filter((item) => item.status === RequirementStatus.REJECTED),
      all: requirements,
    };
  }

  async requests(auth: AuthContext) {
    const clientId = this.clientId(auth);
    const now = new Date();
    const requests = await this.prisma.clientRequest.findMany({
      where: { organizationId: auth.organizationId, clientId },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      include: {
        case: { select: { id: true, title: true } },
        requirement: { select: { id: true, name: true, status: true } },
      },
    });

    const isOverdue = (deadline: Date | null, status: RequestStatus) =>
      status === RequestStatus.OVERDUE || (!!deadline && deadline < now && status === RequestStatus.OPEN);

    return {
      open: requests.filter((item) => item.status === RequestStatus.OPEN && !isOverdue(item.deadline, item.status)),
      overdue: requests.filter((item) => isOverdue(item.deadline, item.status)),
      completed: requests.filter((item) => item.status === RequestStatus.COMPLETED),
      cancelled: requests.filter((item) => item.status === RequestStatus.CANCELLED),
    };
  }

  async messages(auth: AuthContext) {
    const clientId = this.clientId(auth);
    const cases = await this.prisma.case.findMany({
      where: { organizationId: auth.organizationId, clientId },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        title: true,
        assignedUser: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } } },
        },
      },
    });
    if (cases.length === 0) throw new NotFoundException('No cases found');
    return cases;
  }
}
