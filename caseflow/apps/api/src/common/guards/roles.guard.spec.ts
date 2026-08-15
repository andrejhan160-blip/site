import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

const contextFor = (auth: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('denies CLIENT principals on routes that do not opt them in', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextFor({ role: Role.CLIENT }))).toThrow(ForbiddenException);
  });

  it('allows a role listed by @Roles()', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === 'caseflow:roles' ? [Role.CLIENT] : undefined)),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextFor({ role: Role.CLIENT }))).toBe(true);
  });

  it('denies a role that is not listed', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === 'caseflow:roles' ? [Role.OWNER, Role.ADMIN] : undefined)),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextFor({ role: Role.SPECIALIST }))).toThrow(ForbiddenException);
  });
});
