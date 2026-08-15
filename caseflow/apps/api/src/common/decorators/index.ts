import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { AuthContext } from '../types/auth-context';

export const IS_PUBLIC_KEY = 'caseflow:isPublic';
export const ROLES_KEY = 'caseflow:roles';

/** Marks a route as reachable without a session (login, webhooks, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the listed roles. Enforced by RolesGuard on the server. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const request = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
  if (!request.auth) {
    throw new Error('CurrentUser used on a route without SessionGuard');
  }
  return request.auth;
});
