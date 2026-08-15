import { Injectable } from '@nestjs/common';
import { ActorType, EventType, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CaseAccessService } from '../cases/case-access.service';
import type { SendMessageInput } from '../cases/cases.schema';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';

/**
 * Case-scoped conversation. The MVP intentionally uses request/refresh rather
 * than websockets; the read model is a simple ordered list per case.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
    private readonly events: EventsService,
    private readonly notifications: NotificationService,
  ) {}

  async list(auth: AuthContext, caseId: string) {
    await this.access.assertAccess(auth, caseId);
    const messages = await this.prisma.message.findMany({
      where: { caseId, organizationId: auth.organizationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } } },
    });

    const now = new Date();
    await this.prisma.message.updateMany({
      where: {
        caseId,
        organizationId: auth.organizationId,
        ...(auth.role === Role.CLIENT
          ? { readByClientAt: null, senderType: ActorType.USER }
          : { readByStaffAt: null, senderType: ActorType.CLIENT }),
      },
      data: auth.role === Role.CLIENT ? { readByClientAt: now } : { readByStaffAt: now },
    });

    return messages;
  }

  async send(auth: AuthContext, caseId: string, input: SendMessageInput) {
    const target = await this.access.assertAccess(auth, caseId);
    const fromClient = auth.role === Role.CLIENT;

    const message = await this.prisma.message.create({
      data: {
        organizationId: auth.organizationId,
        caseId,
        senderId: auth.userId,
        senderType: fromClient ? ActorType.CLIENT : ActorType.USER,
        body: input.body,
      },
      include: { sender: { select: { id: true, name: true, role: true, avatarUrl: true } } },
    });

    await this.events.recordAs(auth, {
      caseId,
      eventType: EventType.MESSAGE_SENT,
      payload: { messageId: message.id, excerpt: input.body.slice(0, 140) },
    });

    const excerpt = input.body.length > 200 ? `${input.body.slice(0, 200)}…` : input.body;

    if (fromClient) {
      if (target.assignedUserId) {
        await this.notifications.notify({
          organizationId: auth.organizationId,
          userId: target.assignedUserId,
          templateKey: 'message.received',
          link: `/cases/${caseId}?tab=messages`,
          data: { senderName: auth.name, caseTitle: target.title, excerpt },
        });
      }
    } else {
      await this.notifications.notify({
        organizationId: auth.organizationId,
        clientId: target.clientId,
        templateKey: 'message.received',
        link: `/portal/messages`,
        data: { senderName: auth.name, caseTitle: target.title, excerpt },
      });
    }

    return message;
  }

  async listForClient(auth: AuthContext) {
    return this.prisma.message.findMany({
      where: { organizationId: auth.organizationId, case: { clientId: auth.clientId ?? '__no_client__' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        sender: { select: { id: true, name: true, role: true } },
        case: { select: { id: true, title: true } },
      },
    });
  }
}
