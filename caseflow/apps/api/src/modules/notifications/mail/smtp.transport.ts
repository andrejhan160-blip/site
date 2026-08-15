import { Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { MailMessage, MailTransport } from './mail.transport';

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpMailTransport implements MailTransport {
  readonly name = 'smtp';
  private readonly logger = new Logger('Mail');
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.password } : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.options.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    this.logger.debug(`Sent "${message.subject}" to ${message.to}`);
  }
}
