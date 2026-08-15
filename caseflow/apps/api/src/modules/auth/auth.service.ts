import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashToken, randomToken } from '../../common/utils/crypto';
import type { AppConfig } from '../../config/configuration';
import { NotificationService } from '../notifications/notification.service';

export interface MagicLinkRequest {
  email: string;
  /** Organization slug; resolves which tenant the sign-in belongs to. */
  organizationSlug?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Issues a single-use magic link. The response is deliberately identical for
   * known and unknown addresses so the endpoint cannot enumerate accounts.
   */
  async requestMagicLink(input: MagicLinkRequest): Promise<{ sent: true; devLink?: string }> {
    const email = input.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isActive: true,
        ...(input.organizationSlug ? { organization: { slug: input.organizationSlug } } : {}),
      },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      this.logger.debug(`Magic link requested for unknown address ${email}`);
      return { sent: true };
    }

    const ttlMinutes = this.config.get('MAGIC_LINK_TTL_MINUTES', { infer: true });
    const token = randomToken(32);

    await this.prisma.magicLinkToken.create({
      data: {
        organizationId: user.organizationId,
        email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        requestedIp: input.ip,
      },
    });

    const path = `/auth/verify?token=${token}&org=${user.organization.slug}`;
    const link = `${this.config.get('APP_URL', { infer: true })}${path}`;

    await this.notifications.notify({
      organizationId: user.organizationId,
      userId: user.id,
      templateKey: 'auth.magic-link',
      channels: [NotificationChannel.EMAIL],
      link: path,
      data: { ttlMinutes: String(ttlMinutes) },
    });

    return {
      sent: true,
      ...(this.config.get('NODE_ENV', { infer: true }) !== 'production' ? { devLink: link } : {}),
    };
  }

  async consumeMagicLink(token: string): Promise<{ userId: string; organizationId: string }> {
    if (!token) throw new BadRequestException('Token is required');

    const record = await this.prisma.magicLinkToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.consumedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('This sign-in link is invalid or has expired');
    }

    const consumed = await this.prisma.magicLinkToken.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedException('This sign-in link has already been used');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: record.email, organizationId: record.organizationId, isActive: true },
    });
    if (!user) throw new UnauthorizedException('Account is no longer active');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return { userId: user.id, organizationId: user.organizationId };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
            supportEmail: true,
            portalWelcomeText: true,
            timezone: true,
          },
        },
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      clientId: user.clientId,
      client: user.client,
      organization: user.organization,
    };
  }
}
