import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../../modules/auth/session.service';
import { IS_PUBLIC_KEY } from '../decorators';
import type { AuthContext } from '../types/auth-context';

/**
 * Global authentication guard. Every route is private unless explicitly marked
 * @Public(), so a new endpoint cannot leak data by omission.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Authentication required');

    request.auth = await this.sessions.resolve(token);
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    const fromCookie = cookies?.[this.sessions.cookieName];
    if (fromCookie) return fromCookie;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
