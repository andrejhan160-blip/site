import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CaseAccessService } from './case-access.service';

const auth = (overrides: Partial<AuthContext>): AuthContext => ({
  userId: 'user-1',
  organizationId: 'org-1',
  role: Role.MANAGER,
  email: 'staff@example.com',
  name: 'Staff',
  clientId: null,
  sessionId: 'session-1',
  ...overrides,
});

describe('CaseAccessService', () => {
  const findFirst = jest.fn();
  const prisma = { case: { findFirst } } as unknown as PrismaService;
  const service = new CaseAccessService(prisma);

  beforeEach(() => findFirst.mockReset());

  it('always scopes by the organization from the session', () => {
    expect(service.scope(auth({}))).toEqual({ organizationId: 'org-1' });
  });

  it('limits specialists to their own assignments', () => {
    expect(service.scope(auth({ role: Role.SPECIALIST }))).toEqual({
      organizationId: 'org-1',
      assignedUserId: 'user-1',
    });
  });

  it('limits clients to their own cases', () => {
    expect(service.scope(auth({ role: Role.CLIENT, clientId: 'client-9' }))).toEqual({
      organizationId: 'org-1',
      clientId: 'client-9',
    });
  });

  it('matches nothing when a client principal has no linked client record', () => {
    const scope = service.scope(auth({ role: Role.CLIENT, clientId: null }));
    expect(scope.clientId).toBe('__no_client__');
  });

  it('reports a cross-tenant case as not found rather than forbidden', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.assertAccess(auth({}), 'case-from-other-org')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) }),
    );
  });
});
