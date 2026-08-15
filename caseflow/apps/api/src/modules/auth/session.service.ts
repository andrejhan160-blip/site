import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { hashToken, randomToken } from '../../common/utils/crypto';
import type { AppConfig } from '../../config/configuration';

interface SessionTokenPayload {
  sid: string;
  sub: string;
  org: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  get cookieName(): string {
    return this.config.get('SESSION_COOKIE_NAME', { infer: true });
  }

  async issue(
    userId: string,
    organizationId: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    const ttlHours = this.config.get('SESSION_TTL_HOURS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const opaque = randomToken(48);

    const session = await this.prisma.session.create({
      data: {
        organizationId,
        userId,
        tokenHash: hashToken(opaque),
        userAgent: meta.userAgent?.slice(0, 250),
        ip: meta.ip,
        expiresAt,
      },
    });

    // The JWT carries the session id; the opaque half is verified against the
    // stored hash so a leaked signing key alone cannot mint usable sessions.
    const token = await this.jwt.signAsync(
      { sid: session.id, sub: userId, org: organizationId } satisfies SessionTokenPayload,
      { expiresIn: `${ttlHours}h` },
    );

    return { token: `${token}.${opaque}`, expiresAt };
  }

  async resolve(rawToken: string): Promise<AuthContext> {
    const separator = rawToken.lastIndexOf('.');
    if (separator === -1) throw new UnauthorizedException('Повреждён токен сессии');

    const jwtPart = rawToken.slice(0, separator);
    const opaquePart = rawToken.slice(separator + 1);

    let payload: SessionTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionTokenPayload>(jwtPart);
    } catch {
      throw new UnauthorizedException('Недействительная сессия');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now() ||
      session.tokenHash !== hashToken(opaquePart) ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Сессия истекла');
    }

    return {
      userId: session.user.id,
      organizationId: session.organizationId,
      role: session.user.role,
      email: session.user.email,
      name: session.user.name,
      clientId: session.user.clientId,
      sessionId: session.id,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      expires: expiresAt,
      path: '/',
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(this.cookieName, { path: '/' });
  }
}
