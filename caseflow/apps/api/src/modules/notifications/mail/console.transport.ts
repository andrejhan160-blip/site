import { Logger } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail.transport';

/** Development transport: writes the message to the log instead of sending it. */
export class ConsoleMailTransport implements MailTransport {
  readonly name = 'console';
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`✉️  To: ${message.to}\n    Subject: ${message.subject}\n    ${message.text.replace(/\n/g, '\n    ')}`);
  }
}
