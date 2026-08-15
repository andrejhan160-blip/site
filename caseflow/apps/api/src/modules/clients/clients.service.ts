import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { paginate, skipTake, type Paginated } from '../../common/utils/pagination';
import type { CreateClientInput, ListClientsQuery, UpdateClientInput } from './clients.schema';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: ListClientsQuery): Promise<Paginated<unknown>> {
    const where: Prisma.ClientWhereInput = {
      organizationId: auth.organizationId,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.hasActiveCases ? { cases: { some: { status: CaseStatus.ACTIVE } } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        ...skipTake(query),
        orderBy: { lastName: 'asc' },
        include: {
          cases: {
            select: {
              id: true,
              title: true,
              status: true,
              progress: true,
              lastActivityAt: true,
              assignedUser: { select: { id: true, name: true } },
            },
            orderBy: { lastActivityAt: 'desc' },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const items = rows.map((client) => {
      const activeCases = client.cases.filter((item) => item.status === CaseStatus.ACTIVE);
      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        activeCaseCount: activeCases.length,
        totalCaseCount: client.cases.length,
        assignedUser: activeCases[0]?.assignedUser ?? client.cases[0]?.assignedUser ?? null,
        lastActivityAt: client.cases[0]?.lastActivityAt ?? client.updatedAt,
        status: activeCases.length > 0 ? 'ACTIVE' : client.cases.length > 0 ? 'COMPLETED' : 'NEW',
      };
    });

    return paginate(items, total, query);
  }

  async get(auth: AuthContext, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: {
        portalUser: { select: { id: true, email: true, lastLoginAt: true } },
        cases: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedUser: { select: { id: true, name: true } },
            currentStage: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!client) throw new NotFoundException('Клиент не найден');

    const recentActivity = await this.prisma.event.findMany({
      where: { organizationId: auth.organizationId, case: { clientId: client.id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { case: { select: { id: true, title: true } } },
    });

    return {
      ...client,
      activeCases: client.cases.filter((item) => item.status === CaseStatus.ACTIVE),
      completedCases: client.cases.filter((item) => item.status === CaseStatus.COMPLETED),
      recentActivity,
    };
  }

  async create(auth: AuthContext, input: CreateClientInput) {
    const existing = await this.prisma.client.findFirst({
      where: { organizationId: auth.organizationId, email: input.email },
    });
    if (existing) throw new ConflictException('Клиент с такой почтой уже есть');

    const { createPortalAccess, ...data } = input;

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: { ...data, organizationId: auth.organizationId },
      });

      if (createPortalAccess) {
        const conflictingUser = await tx.user.findFirst({
          where: { organizationId: auth.organizationId, email: input.email },
        });
        if (!conflictingUser) {
          await tx.user.create({
            data: {
              organizationId: auth.organizationId,
              email: input.email,
              name: `${input.firstName} ${input.lastName}`.trim(),
              role: Role.CLIENT,
              clientId: client.id,
            },
          });
        }
      }

      return client;
    });
  }

  async update(auth: AuthContext, id: string, input: UpdateClientInput) {
    const updated = await this.prisma.client.updateMany({
      where: { id, organizationId: auth.organizationId },
      data: input,
    });
    if (updated.count === 0) throw new NotFoundException('Клиент не найден');

    if (input.firstName || input.lastName || input.email) {
      const client = await this.prisma.client.findFirstOrThrow({
        where: { id, organizationId: auth.organizationId },
      });
      await this.prisma.user.updateMany({
        where: { clientId: id, organizationId: auth.organizationId },
        data: {
          name: `${client.firstName} ${client.lastName}`.trim(),
          ...(input.email ? { email: input.email } : {}),
        },
      });
    }

    return this.prisma.client.findFirstOrThrow({ where: { id, organizationId: auth.organizationId } });
  }
}
