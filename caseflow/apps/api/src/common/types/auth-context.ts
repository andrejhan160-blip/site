import { Role } from '@prisma/client';

/**
 * The authenticated principal for a request. `organizationId` is always taken
 * from the server-side session — never from a header, body or query parameter.
 */
export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
  email: string;
  name: string;
  /** Set only for CLIENT principals; links the portal user to its Client row. */
  clientId: string | null;
  sessionId: string;
}

export const STAFF_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}
