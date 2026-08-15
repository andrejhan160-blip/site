import { CrmProviderKind } from '@prisma/client';
import { z } from 'zod';

export const upsertConnectionSchema = z.object({
  provider: z.nativeEnum(CrmProviderKind).default(CrmProviderKind.BITRIX24),
  isActive: z.boolean().default(true),
  baseUrl: z.string().url().optional(),
  /** e.g. { inboundWebhookUrl: "https://acme.bitrix24.eu/rest/1/token" } */
  credentials: z.record(z.string()).default({}),
  syncedFields: z.array(z.string().trim().max(64)).max(30).default([]),
});

export const stageMappingSchema = z.object({
  pipelineId: z.string().trim().min(1).max(64),
  pipelineName: z.string().trim().max(160).optional(),
  externalStageId: z.string().trim().min(1).max(64),
  externalStageName: z.string().trim().max(160).optional(),
  templateStageId: z.string().uuid().nullable(),
});

export const replaceMappingsSchema = z.object({
  mappings: z.array(stageMappingSchema).max(200),
});

export type UpsertConnectionInput = z.infer<typeof upsertConnectionSchema>;
export type ReplaceMappingsInput = z.infer<typeof replaceMappingsSchema>;
