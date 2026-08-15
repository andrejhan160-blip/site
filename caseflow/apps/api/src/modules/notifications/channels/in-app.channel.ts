import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { NotificationChannelDriver, NotificationDelivery } from './notification-channel';

@Injectable()
export class InAppNotificationChannel implements NotificationChannelDriver {
  readonly channel = NotificationChannel.IN_APP;

  constructor(private readonly prisma: PrismaService) {}

  isEnabled(): boolean {
    return true;
  }

  async deliver(delivery: NotificationDelivery): Promise<void> {
    if (!delivery.recipient.userId) return;
    await this.prisma.notification.create({
      data: {
        organizationId: delivery.recipient.organizationId,
        userId: delivery.recipient.userId,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        templateKey: delivery.templateKey,
        subject: delivery.rendered.subject,
        body: delivery.rendered.text,
        linkUrl: delivery.linkUrl,
        payload: delivery.payload as never,
      },
    });
  }
}
