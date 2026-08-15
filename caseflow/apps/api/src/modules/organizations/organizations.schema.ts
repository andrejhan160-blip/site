import { Role } from '@prisma/client';
import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Укажите цвет в hex-формате, например #1F6FEB')
    .optional(),
  supportEmail: z.string().email().nullable().optional(),
  portalWelcomeText: z.string().trim().max(1000).nullable().optional(),
  timezone: z.string().trim().max(64).optional(),
  /** Reserved for the custom-domain rollout; stored but not yet routed. */
  customDomain: z.string().trim().max(190).nullable().optional(),
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.nativeEnum(Role).refine((role) => role !== Role.CLIENT, {
    message: 'Учётные записи клиентов создаются на экране «Клиенты»',
  }),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
