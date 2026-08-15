import { Inject, Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { MAIL_TRANSPORT, type MailTransport } from '../mail/mail.transport';
import type { NotificationChannelDriver, NotificationDelivery } from './notification-channel';

@Injectable()
export class EmailNotificationChannel implements NotificationChannelDriver {
  readonly channel = NotificationChannel.EMAIL;

  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  isEnabled(): boolean {
    return true;
  }

  async deliver(delivery: NotificationDelivery): Promise<void> {
    if (!delivery.recipient.email) return;
    await this.transport.send({
      to: delivery.recipient.email,
      subject: delivery.rendered.subject,
      text: delivery.rendered.text,
      html: delivery.rendered.html,
    });
  }
}
