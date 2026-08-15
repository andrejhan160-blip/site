import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { hashToken } from '../utils/crypto';

/**
 * Rate limiting keyed by session rather than by IP.
 *
 * Every request from the web app arrives from the same host, so an IP-based
 * bucket would let one busy user throttle everyone. Anonymous traffic — the
 * sign-in endpoints and CRM webhooks — still falls back to the client IP.
 */
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'cf_session';
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[cookieName] ?? req.headers.authorization?.replace('Bearer ', '');

    if (token) return `session:${hashToken(token).slice(0, 32)}`;

    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0]?.trim() ?? req.ip);
    return `ip:${ip ?? 'unknown'}`;
  }
}
