import { Injectable } from '@nestjs/common';
import { ActorType, EventType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';

export interface RecordEventInput {
  organizationId: string;
  caseId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  actorLabel?: string | null;
  eventType: EventType;
  payload?: Prisma.InputJsonValue;
}

/**
 * Append-only activity log. The service exposes no update or delete path — the
 * audit trail is the record of what happened, not a mutable projection.
 */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.event.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
        eventType: input.eventType,
        payload: input.payload ?? {},
      },
    });

    if (input.caseId) {
      await client.case.updateMany({
        where: { id: input.caseId, organizationId: input.organizationId },
        data: { lastActivityAt: new Date() },
      });
    }
  }

  /** Records an event attributed to the authenticated principal. */
  async recordAs(
    auth: AuthContext,
    input: Omit<RecordEventInput, 'organizationId' | 'actorType' | 'actorId' | 'actorLabel'>,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.record(
      {
        ...input,
        organizationId: auth.organizationId,
        actorType: auth.role === 'CLIENT' ? ActorType.CLIENT : ActorType.USER,
        actorId: auth.userId,
        actorLabel: auth.name,
      },
      tx,
    );
  }

  async listForCase(organizationId: string, caseId: string, limit = 100) {
    return this.prisma.event.findMany({
      where: { organizationId, caseId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listForOrganization(organizationId: string, limit = 50) {
    return this.prisma.event.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { case: { select: { id: true, title: true } } },
    });
  }
}
