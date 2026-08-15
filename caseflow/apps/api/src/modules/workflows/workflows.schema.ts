import { z } from 'zod';

export const templateRequirementSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(2000).optional(),
  required: z.boolean().default(true),
  deadlineDays: z.number().int().min(0).max(3650).nullable().optional(),
});

export const templateStageSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  requirements: z.array(templateRequirementSchema).default([]),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().default(true),
  stages: z.array(templateStageSchema).min(1),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
