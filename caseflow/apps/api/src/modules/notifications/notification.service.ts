import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AppConfig } from '../../config/configuration';
import { JOB_QUEUE, type JobQueue } from '../queue/job-queue';

export const NOTIFICATION_JOB = 'notification.send';

export interface NotifyRecipientRef {
  /** Staff recipient. */
  userId?: string;
  /** Client recipient; resolved to their portal user when one exists. */
  clientId?: string;
}

export interface NotifyInput extends NotifyRecipientRef {
  organizationId: string;
  templateKey: string;
  channels?: NotificationChannel[];
  /** Path inside the app, e.g. `/cases/123`. Combined with APP_URL. */
  link?: string;
  data?: Record<string, unknown>;
}

export interface NotificationJobPayload {
  organizationId: string;
  userId: string | null;
  email: string | null;
  name: string;
  templateKey: string;
  channels: NotificationChannel[];
  linkUrl?: string;
  data: Record<string, unknown>;
}

/**
 * Business modules depend on this service only. It resolves the recipient,
 * decides on channels and hands delivery to the queue; nothing here knows about
 * SMTP, Telegram or any other provider.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const recipient = await this.resolveRecipient(input);
    if (!recipient) {
      this.logger.debug(`No recipient resolved for ${input.templateKey}; skipping`);
      return;
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { name: true, primaryColor: true },
    });

    const payload: NotificationJobPayload = {
      ...recipient,
      organizationId: input.organizationId,
      templateKey: input.templateKey,
      channels: input.channels ?? [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      linkUrl: input.link ? `${this.config.get('APP_URL', { infer: true })}${input.link}` : undefined,
      data: {
        organizationName: organization?.name ?? 'CaseFlow',
        primaryColor: organization?.primaryColor ?? '#1F6FEB',
        ...input.data,
      },
    };

    await this.queue.enqueue(NOTIFICATION_JOB, payload);
  }

  /** Fan-out helper: notify every staff member holding one of the given roles. */
  async notifyRoles(
    organizationId: string,
    roles: Role[],
    input: Omit<NotifyInput, 'organizationId' | 'userId' | 'clientId'>,
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, role: { in: roles }, isActive: true },
      select: { id: true },
    });
    await Promise.all(users.map((user) => this.notify({ ...input, organizationId, userId: user.id })));
  }

  private async resolveRecipient(
    input: NotifyInput,
  ): Promise<{ userId: string | null; email: string | null; name: string } | null> {
    if (input.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: input.userId, organizationId: input.organizationId, isActive: true },
        select: { id: true, email: true, name: true },
      });
      return user ? { userId: user.id, email: user.email, name: user.name } : null;
    }

    if (input.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: input.clientId, organizationId: input.organizationId },
        select: { email: true, firstName: true, lastName: true, portalUser: { select: { id: true } } },
      });
      if (!client) return null;
      return {
        userId: client.portalUser?.id ?? null,
        email: client.email,
        name: `${client.firstName} ${client.lastName}`.trim(),
      };
    }

    return null;
  }
}
