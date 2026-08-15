import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination';

export const listClientsSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  hasActiveCases: z.coerce.boolean().optional(),
});

export const createClientSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  telegramId: z.string().trim().max(80).optional(),
  externalCrmContactId: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Creates the matching portal account so the client can sign in. */
  createPortalAccess: z.boolean().default(true),
});

export const updateClientSchema = createClientSchema.partial().omit({ createPortalAccess: true });

export type ListClientsQuery = z.infer<typeof listClientsSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
