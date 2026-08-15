/**
 * Transport-level mail abstraction. Business code never imports a provider SDK;
 * swapping SMTP for a hosted API is a new implementation of this interface.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailTransport {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
