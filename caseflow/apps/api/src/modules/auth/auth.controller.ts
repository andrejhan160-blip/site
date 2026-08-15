import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../common/types/auth-context';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

const requestLinkSchema = z.object({
  email: z.string().email(),
  organizationSlug: z.string().min(1).optional(),
});

const verifySchema = z.object({ token: z.string().min(10) });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('magic-link')
  async requestMagicLink(
    @Body(zodPipe(requestLinkSchema)) body: z.infer<typeof requestLinkSchema>,
    @Req() req: Request,
  ) {
    return this.auth.requestMagicLink({ ...body, ip: req.ip });
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('verify')
  async verify(
    @Body(zodPipe(verifySchema)) body: z.infer<typeof verifySchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, organizationId } = await this.auth.consumeMagicLink(body.token);
    const { token, expiresAt } = await this.sessions.issue(userId, organizationId, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.sessions.setCookie(res, token, expiresAt);
    const profile = await this.auth.profile(userId);
    return { user: profile, expiresAt };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST, Role.CLIENT)
  @Get('me')
  async me(@CurrentUser() auth: AuthContext) {
    return this.auth.profile(auth.userId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST, Role.CLIENT)
  @Post('logout')
  async logout(@CurrentUser() auth: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revoke(auth.sessionId);
    this.sessions.clearCookie(res);
    return { ok: true };
  }
}
