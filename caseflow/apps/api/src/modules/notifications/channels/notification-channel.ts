import { NotificationChannel } from '@prisma/client';
import type { RenderedNotification } from '../templates/notification-templates';

export interface NotificationRecipient {
  organizationId: string;
  userId: string | null;
  email: string | null;
  name: string;
}

export interface NotificationDelivery {
  recipient: NotificationRecipient;
  templateKey: string;
  rendered: RenderedNotification;
  linkUrl?: string;
  payload: Record<string, unknown>;
}

/**
 * A delivery channel. Adding Telegram/WhatsApp/SMS later means implementing this
 * interface and registering the driver — no change to business modules.
 */
export interface NotificationChannelDriver {
  readonly channel: NotificationChannel;
  isEnabled(): boolean;
  deliver(delivery: NotificationDelivery): Promise<void>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
