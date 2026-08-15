import { Injectable } from '@nestjs/common';
import { CaseStatus, DocumentStatus, RequestStatus, RequirementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CaseAccessService } from '../cases/case-access.service';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
  ) {}

  /** Everything the employee dashboard needs, in one round trip. */
  async overview(auth: AuthContext) {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 2 * DAY);
    const staleBefore = new Date(now.getTime() - 7 * DAY);
    const caseScope = this.access.scope(auth);

    const [
      overdueRequests,
      documentsForReview,
      upcomingRequirementDeadlines,
      upcomingRequestDeadlines,
      staleCases,
      recentUploads,
      activeCases,
      myCases,
    ] = await this.prisma.$transaction([
      this.prisma.clientRequest.findMany({
        where: {
          organizationId: auth.organizationId,
          case: caseScope,
          status: { in: [RequestStatus.OPEN, RequestStatus.OVERDUE] },
          deadline: { lt: now },
        },
        orderBy: { deadline: 'asc' },
        take: 20,
        include: {
          case: { select: { id: true, title: true } },
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.document.findMany({
        where: {
          organizationId: auth.organizationId,
          case: caseScope,
          status: DocumentStatus.UNDER_REVIEW,
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          case: { select: { id: true, title: true, client: { select: { firstName: true, lastName: true } } } },
          requirement: { select: { id: true, name: true } },
        },
      }),
      this.prisma.documentRequirement.findMany({
        where: {
          case: { organizationId: auth.organizationId, ...caseScope },
          status: { in: [RequirementStatus.PENDING, RequirementStatus.REJECTED, RequirementStatus.UNDER_REVIEW] },
          deadline: { gte: now, lte: in48Hours },
        },
        orderBy: { deadline: 'asc' },
        take: 20,
        include: { case: { select: { id: true, title: true, client: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.clientRequest.findMany({
        where: {
          organizationId: auth.organizationId,
          case: caseScope,
          status: RequestStatus.OPEN,
          deadline: { gte: now, lte: in48Hours },
        },
        orderBy: { deadline: 'asc' },
        take: 20,
        include: { case: { select: { id: true, title: true } } },
      }),
      this.prisma.case.findMany({
        where: { ...caseScope, status: CaseStatus.ACTIVE, lastActivityAt: { lt: staleBefore } },
        orderBy: { lastActivityAt: 'asc' },
        take: 20,
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          assignedUser: { select: { id: true, name: true } },
          currentStage: { select: { id: true, name: true } },
        },
      }),
      this.prisma.document.findMany({
        where: { organizationId: auth.organizationId, case: caseScope },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          case: { select: { id: true, title: true, client: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.case.count({ where: { ...caseScope, status: CaseStatus.ACTIVE } }),
      this.prisma.case.count({ where: { ...caseScope, status: CaseStatus.ACTIVE, assignedUserId: auth.userId } }),
    ]);

    const needsAttention = await this.prisma.case.findMany({
      where: {
        ...caseScope,
        status: CaseStatus.ACTIVE,
        OR: [
          { requests: { some: { status: RequestStatus.OPEN, deadline: { lt: now } } } },
          { documents: { some: { status: DocumentStatus.UNDER_REVIEW } } },
          { lastActivityAt: { lt: staleBefore } },
          { requirements: { some: { status: RequirementStatus.REJECTED } } },
        ],
      },
      orderBy: { lastActivityAt: 'asc' },
      take: 12,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedUser: { select: { id: true, name: true } },
        currentStage: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
    });

    return {
      metrics: {
        activeCases,
        myCases,
        documentsForReview: documentsForReview.length,
        overdueRequests: overdueRequests.length,
      },
      needsAttention,
      overdueRequests,
      documentsForReview,
      deadlines: [
        ...upcomingRequirementDeadlines.map((item) => ({
          id: item.id,
          kind: 'DOCUMENT' as const,
          title: item.name,
          deadline: item.deadline,
          caseId: item.caseId,
          caseTitle: item.case.title,
          clientName: `${item.case.client.firstName} ${item.case.client.lastName}`,
        })),
        ...upcomingRequestDeadlines.map((item) => ({
          id: item.id,
          kind: 'REQUEST' as const,
          title: item.title,
          deadline: item.deadline,
          caseId: item.caseId,
          caseTitle: item.case.title,
          clientName: '',
        })),
      ].sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0)),
      staleCases,
      recentUploads,
    };
  }
}
