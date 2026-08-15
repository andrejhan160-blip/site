import { CaseStatus, RequestType, StageStatus, TaskStatus, TaskVisibility } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination';

export const listCasesSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  assignedUserId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  workflowTemplateId: z.string().uuid().optional(),
  stageName: z.string().trim().max(160).optional(),
  overdue: z.coerce.boolean().optional(),
});

export const createCaseSchema = z.object({
  clientId: z.string().uuid(),
  workflowTemplateId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  assignedUserId: z.string().uuid().optional(),
  externalCrmEntityId: z.string().trim().max(80).optional(),
  /** Anchors template deadlines (deadlineDays) to a start date. */
  startDate: z.coerce.date().optional(),
});

export const updateCaseSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
});

export const changeStageSchema = z.object({
  stageId: z.string().uuid(),
  /** Marks every earlier stage completed; the default for a forward move. */
  completePrevious: z.boolean().default(true),
  note: z.string().trim().max(500).optional(),
});

export const updateStageSchema = z.object({
  status: z.nativeEnum(StageStatus).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const requestDocumentSchema = z.object({
  stageId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(2000).optional(),
  required: z.boolean().default(true),
  deadline: z.coerce.date().optional(),
  notifyClient: z.boolean().default(true),
});

export const createRequestSchema = z.object({
  type: z.nativeEnum(RequestType).default(RequestType.INFORMATION),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  deadline: z.coerce.date().optional(),
  notifyClient: z.boolean().default(true),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  assignedToId: z.string().uuid().optional(),
  deadline: z.coerce.date().optional(),
  visibility: z.nativeEnum(TaskVisibility).default(TaskVisibility.INTERNAL),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  visibility: z.nativeEnum(TaskVisibility).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const reviewDocumentSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().trim().max(1000).optional(),
});

export type ListCasesQuery = z.infer<typeof listCasesSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type ChangeStageInput = z.infer<typeof changeStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type RequestDocumentInput = z.infer<typeof requestDocumentSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
