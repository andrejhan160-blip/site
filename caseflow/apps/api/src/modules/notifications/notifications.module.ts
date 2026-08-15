import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { EmailNotificationChannel } from './channels/email.channel';
import { InAppNotificationChannel } from './channels/in-app.channel';
import { ConsoleMailTransport } from './mail/console.transport';
import { MAIL_TRANSPORT, type MailTransport } from './mail/mail.transport';
import { SmtpMailTransport } from './mail/smtp.transport';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): MailTransport => {
        if (config.get('MAIL_DRIVER', { infer: true }) === 'smtp') {
          return new SmtpMailTransport({
            host: config.get('SMTP_HOST', { infer: true }) ?? 'localhost',
            port: config.get('SMTP_PORT', { infer: true }) ?? 587,
            secure: config.get('SMTP_SECURE', { infer: true }),
            user: config.get('SMTP_USER', { infer: true }),
            password: config.get('SMTP_PASSWORD', { infer: true }),
            from: config.get('MAIL_FROM', { infer: true }),
          });
        }
        return new ConsoleMailTransport();
      },
    },
    EmailNotificationChannel,
    InAppNotificationChannel,
    NotificationDispatcher,
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
