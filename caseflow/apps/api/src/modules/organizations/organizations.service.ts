import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import type { InviteUserInput, UpdateOrganizationInput, UpdateUserInput } from './organizations.schema';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(auth: AuthContext) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: auth.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        customDomain: true,
        timezone: true,
        primaryColor: true,
        supportEmail: true,
        portalWelcomeText: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(auth: AuthContext, input: UpdateOrganizationInput) {
    if (input.customDomain) {
      const taken = await this.prisma.organization.findFirst({
        where: { customDomain: input.customDomain, id: { not: auth.organizationId } },
      });
      if (taken) throw new ConflictException('Этот домен уже занят');
    }
    await this.prisma.organization.update({ where: { id: auth.organizationId }, data: input });
    return this.get(auth);
  }

  async listUsers(auth: AuthContext) {
    return this.prisma.user.findMany({
      where: { organizationId: auth.organizationId, role: { not: Role.CLIENT } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        _count: { select: { assignedCases: true } },
      },
    });
  }

  async inviteUser(auth: AuthContext, input: InviteUserInput) {
    const existing = await this.prisma.user.findFirst({
      where: { organizationId: auth.organizationId, email: input.email },
    });
    if (existing) throw new ConflictException('Эта почта уже принадлежит сотруднику вашей команды');

    return this.prisma.user.create({
      data: { ...input, organizationId: auth.organizationId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }

  async updateUser(auth: AuthContext, userId: string, input: UpdateUserInput) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: auth.organizationId },
    });
    if (!user) throw new NotFoundException('Сотрудник не найден');
    if (user.role === Role.CLIENT) throw new BadRequestException('Учётные записи клиентов создаются на экране «Клиенты»');

    if (user.role === Role.OWNER && input.role && input.role !== Role.OWNER) {
      const owners = await this.prisma.user.count({
        where: { organizationId: auth.organizationId, role: Role.OWNER, isActive: true },
      });
      if (owners <= 1) throw new BadRequestException('В организации должен остаться хотя бы один владелец');
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: input,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }
}
