import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';

export interface AccessibleCase {
  id: string;
  organizationId: string;
  clientId: string;
  assignedUserId: string | null;
  title: string;
  currentStageId: string | null;
}

/**
 * Single choke point for case-level authorisation. Every read and write path
 * goes through it, so tenant and role rules cannot drift between modules.
 */
@Injectable()
export class CaseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tenant + role scoping expressed as a Prisma filter.
   * - CLIENT sees only their own cases;
   * - SPECIALIST sees only cases assigned to them;
   * - MANAGER/ADMIN/OWNER see everything inside their organization.
   */
  scope(auth: AuthContext): Prisma.CaseWhereInput {
    const base: Prisma.CaseWhereInput = { organizationId: auth.organizationId };

    if (auth.role === Role.CLIENT) {
      // A client principal without a linked Client row can never match a case.
      return { ...base, clientId: auth.clientId ?? '__no_client__' };
    }
    if (auth.role === Role.SPECIALIST) {
      return { ...base, assignedUserId: auth.userId };
    }
    return base;
  }

  async assertAccess(auth: AuthContext, caseId: string): Promise<AccessibleCase> {
    const found = await this.prisma.case.findFirst({
      where: { id: caseId, ...this.scope(auth) },
      select: {
        id: true,
        organizationId: true,
        clientId: true,
        assignedUserId: true,
        title: true,
        currentStageId: true,
      },
    });

    if (!found) {
      // Deliberately indistinguishable from "does not exist" — a caller must not
      // be able to probe for the existence of another tenant's case.
      throw new NotFoundException('Дело не найдено');
    }
    return found;
  }

  assertStaff(auth: AuthContext): void {
    if (auth.role === Role.CLIENT) {
      throw new ForbiddenException('Это действие недоступно в кабинете клиента');
    }
  }
}
