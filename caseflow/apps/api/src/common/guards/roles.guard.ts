import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { STAFF_ROLES, type AuthContext } from '../types/auth-context';

/**
 * Role-based access control. Routes without an explicit @Roles() declaration are
 * staff-only: CLIENT principals reach their data through the /portal endpoints,
 * which opt in with @Roles(Role.CLIENT).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ??
      STAFF_ROLES;

    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    if (!request.auth) throw new ForbiddenException('Authentication required');

    if (!required.includes(request.auth.role)) {
      throw new ForbiddenException('Your role does not allow this action');
    }
    return true;
  }
}
