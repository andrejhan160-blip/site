import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JobRegistry } from '../queue/job-registry.service';
import type { NotificationChannelDriver } from './channels/notification-channel';
import { EmailNotificationChannel } from './channels/email.channel';
import { InAppNotificationChannel } from './channels/in-app.channel';
import { NOTIFICATION_JOB, type NotificationJobPayload } from './notification.service';
import { renderNotification, type NotificationTemplateContext } from './templates/notification-templates';

/** Consumes queued notifications and pushes them through the enabled channels. */
@Injectable()
export class NotificationDispatcher implements OnModuleInit {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly drivers: NotificationChannelDriver[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: JobRegistry,
    email: EmailNotificationChannel,
    inApp: InAppNotificationChannel,
  ) {
    this.drivers = [inApp, email];
  }

  onModuleInit(): void {
    this.registry.register(NOTIFICATION_JOB, (payload) => this.handle(payload as NotificationJobPayload));
  }

  async handle(job: NotificationJobPayload): Promise<void> {
    const context: NotificationTemplateContext = {
      organizationName: String(job.data.organizationName ?? 'CaseFlow'),
      recipientName: job.name,
      actionUrl: job.linkUrl,
      ...job.data,
    };
    const rendered = renderNotification(job.templateKey, context);

    for (const driver of this.drivers) {
      if (!job.channels.includes(driver.channel) || !driver.isEnabled()) continue;
      try {
        await driver.deliver({
          recipient: {
            organizationId: job.organizationId,
            userId: job.userId,
            email: job.email,
            name: job.name,
          },
          templateKey: job.templateKey,
          rendered,
          linkUrl: job.linkUrl,
          payload: job.data,
        });
        if (driver.channel === NotificationChannel.EMAIL) {
          await this.recordEmail(job, rendered.subject, rendered.text, NotificationStatus.SENT);
        }
      } catch (error) {
        this.logger.error(
          `Channel ${driver.channel} failed for ${job.templateKey}`,
          error instanceof Error ? error.stack : String(error),
        );
        if (driver.channel === NotificationChannel.EMAIL) {
          await this.recordEmail(
            job,
            rendered.subject,
            rendered.text,
            NotificationStatus.FAILED,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }
  }

  private async recordEmail(
    job: NotificationJobPayload,
    subject: string,
    body: string,
    status: NotificationStatus,
    error?: string,
  ): Promise<void> {
    if (!job.email) return;
    await this.prisma.notification.create({
      data: {
        organizationId: job.organizationId,
        userId: job.userId,
        channel: NotificationChannel.EMAIL,
        status,
        sentAt: status === NotificationStatus.SENT ? new Date() : null,
        templateKey: job.templateKey,
        subject,
        body,
        linkUrl: job.linkUrl,
        payload: job.data as never,
        error,
      },
    });
  }
}
