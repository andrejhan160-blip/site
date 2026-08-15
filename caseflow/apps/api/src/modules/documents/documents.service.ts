import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActorType,
  DocumentStatus,
  EventType,
  RequestStatus,
  RequestType,
  RequirementStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CaseAccessService } from '../cases/case-access.service';
import { CasesService } from '../cases/cases.service';
import type { RequestDocumentInput, ReviewDocumentInput } from '../cases/cases.schema';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';
import { StorageService } from '../storage/storage.service';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
    private readonly cases: CasesService,
    private readonly events: EventsService,
    private readonly notifications: NotificationService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Creates a document requirement together with the client-facing request, so
   * the item shows up both in the case document list and in the portal
   * "Requests" queue.
   */
  async requestDocument(auth: AuthContext, caseId: string, input: RequestDocumentInput) {
    this.access.assertStaff(auth);
    const target = await this.access.assertAccess(auth, caseId);

    if (input.stageId) {
      const stage = await this.prisma.caseStage.findFirst({ where: { id: input.stageId, caseId } });
      if (!stage) throw new BadRequestException('Stage does not belong to this case');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const requirement = await tx.documentRequirement.create({
        data: {
          caseId,
          stageId: input.stageId ?? target.currentStageId,
          name: input.name,
          description: input.description,
          instructions: input.instructions,
          required: input.required,
          deadline: input.deadline,
          status: RequirementStatus.PENDING,
        },
      });

      const request = await tx.clientRequest.create({
        data: {
          organizationId: auth.organizationId,
          caseId,
          clientId: target.clientId,
          requirementId: requirement.id,
          type: RequestType.DOCUMENT,
          title: input.name,
          description: input.instructions ?? input.description,
          deadline: input.deadline,
          status: RequestStatus.OPEN,
          createdById: auth.userId,
        },
      });

      await this.events.recordAs(
        auth,
        {
          caseId,
          eventType: EventType.DOCUMENT_REQUESTED,
          payload: {
            requirementId: requirement.id,
            name: requirement.name,
            deadline: requirement.deadline?.toISOString() ?? null,
          },
        },
        tx,
      );

      return { requirement, request };
    });

    await this.cases.recalculateProgress(caseId);

    if (input.notifyClient) {
      await this.notifications.notify({
        organizationId: auth.organizationId,
        clientId: target.clientId,
        templateKey: 'document.requested',
        link: `/portal/cases/${caseId}`,
        data: {
          requirementName: input.name,
          caseTitle: target.title,
          deadline: input.deadline ? input.deadline.toISOString().slice(0, 10) : '',
        },
      });
    }

    return result;
  }

  /** Uploads a new version of a document against a requirement. */
  async upload(
    auth: AuthContext,
    caseId: string,
    file: UploadedFile,
    requirementId?: string,
  ) {
    await this.access.assertAccess(auth, caseId);
    this.storage.validate(file);

    let requirement = null;
    if (requirementId) {
      requirement = await this.prisma.documentRequirement.findFirst({
        where: { id: requirementId, caseId },
      });
      if (!requirement) throw new NotFoundException('Document requirement not found');
    }

    const previousVersions = requirementId
      ? await this.prisma.document.count({ where: { requirementId, caseId } })
      : 0;

    const stored = await this.storage.upload({
      organizationId: auth.organizationId,
      caseId,
      filename: file.originalname,
      mimeType: file.mimetype,
      body: file.buffer,
    });

    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          organizationId: auth.organizationId,
          caseId,
          requirementId: requirementId ?? null,
          uploadedById: auth.userId,
          uploadedByType: auth.role === Role.CLIENT ? ActorType.CLIENT : ActorType.USER,
          version: previousVersions + 1,
          filename: file.originalname,
          storageKey: stored.storageKey,
          mimeType: file.mimetype,
          fileSize: stored.fileSize,
          checksum: stored.checksum,
          status: DocumentStatus.UNDER_REVIEW,
        },
      });

      if (requirementId) {
        await tx.documentRequirement.update({
          where: { id: requirementId },
          data: { status: RequirementStatus.UNDER_REVIEW },
        });
      }

      await this.events.recordAs(
        auth,
        {
          caseId,
          eventType: EventType.DOCUMENT_UPLOADED,
          payload: {
            documentId: created.id,
            filename: created.filename,
            version: created.version,
            requirementId: requirementId ?? null,
          },
        },
        tx,
      );

      return created;
    });

    await this.cases.recalculateProgress(caseId);

    const caseRecord = await this.prisma.case.findFirstOrThrow({
      where: { id: caseId },
      select: { title: true, assignedUserId: true, client: { select: { firstName: true, lastName: true } } },
    });

    if (caseRecord.assignedUserId) {
      await this.notifications.notify({
        organizationId: auth.organizationId,
        userId: caseRecord.assignedUserId,
        templateKey: 'document.uploaded',
        link: `/cases/${caseId}?tab=documents`,
        data: {
          filename: document.filename,
          caseTitle: caseRecord.title,
          clientName: `${caseRecord.client.firstName} ${caseRecord.client.lastName}`,
        },
      });
    }

    return document;
  }

  /** Approves or rejects an uploaded document. Rejection requires a reason. */
  async review(auth: AuthContext, documentId: string, input: ReviewDocumentInput) {
    this.access.assertStaff(auth);

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId: auth.organizationId },
      include: { case: { select: { id: true, title: true, clientId: true } } },
    });
    if (!document) throw new NotFoundException('Document not found');
    await this.access.assertAccess(auth, document.caseId);

    if (input.decision === 'REJECT' && !input.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }

    const approved = input.decision === 'APPROVE';

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.document.update({
        where: { id: document.id },
        data: {
          status: approved ? DocumentStatus.APPROVED : DocumentStatus.REJECTED,
          rejectionReason: approved ? null : input.rejectionReason?.trim(),
          reviewedAt: new Date(),
          reviewedById: auth.userId,
        },
      });

      if (document.requirementId) {
        await tx.documentRequirement.update({
          where: { id: document.requirementId },
          data: { status: approved ? RequirementStatus.APPROVED : RequirementStatus.REJECTED },
        });

        if (approved) {
          await tx.clientRequest.updateMany({
            where: { requirementId: document.requirementId, status: RequestStatus.OPEN },
            data: { status: RequestStatus.COMPLETED, completedAt: new Date() },
          });
        } else {
          // A rejected document reopens the client's request so the replacement
          // is requested through the same queue.
          await tx.clientRequest.updateMany({
            where: { requirementId: document.requirementId, status: { in: [RequestStatus.COMPLETED] } },
            data: { status: RequestStatus.OPEN, completedAt: null },
          });
        }
      }

      await this.events.recordAs(
        auth,
        {
          caseId: document.caseId,
          eventType: approved ? EventType.DOCUMENT_APPROVED : EventType.DOCUMENT_REJECTED,
          payload: {
            documentId: document.id,
            filename: document.filename,
            version: document.version,
            rejectionReason: approved ? null : input.rejectionReason?.trim() ?? null,
          },
        },
        tx,
      );

      return result;
    });

    await this.cases.recalculateProgress(document.caseId);

    await this.notifications.notify({
      organizationId: auth.organizationId,
      clientId: document.case.clientId,
      templateKey: approved ? 'document.approved' : 'document.rejected',
      link: `/portal/documents`,
      data: {
        filename: document.filename,
        caseTitle: document.case.title,
        rejectionReason: input.rejectionReason?.trim() ?? '',
      },
    });

    return updated;
  }

  /** Returns a short-lived signed URL. Storage keys are never exposed raw. */
  async downloadUrl(auth: AuthContext, documentId: string): Promise<{ url: string; expiresIn: number }> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId: auth.organizationId },
      select: { id: true, caseId: true, filename: true, storageKey: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    await this.access.assertAccess(auth, document.caseId);

    const url = await this.storage.signedUrl(document.storageKey, document.filename);
    return { url, expiresIn: 300 };
  }

  async listForReview(auth: AuthContext, limit = 20) {
    this.access.assertStaff(auth);
    return this.prisma.document.findMany({
      where: {
        organizationId: auth.organizationId,
        status: DocumentStatus.UNDER_REVIEW,
        case: this.access.scope(auth),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        case: { select: { id: true, title: true, client: { select: { firstName: true, lastName: true } } } },
        requirement: { select: { id: true, name: true } },
      },
    });
  }

  async listForClient(auth: AuthContext) {
    if (auth.role !== Role.CLIENT || !auth.clientId) {
      throw new ForbiddenException('Client portal only');
    }
    return this.prisma.documentRequirement.findMany({
      where: { case: { organizationId: auth.organizationId, clientId: auth.clientId } },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      include: {
        case: { select: { id: true, title: true } },
        stage: { select: { id: true, name: true } },
        documents: { orderBy: { version: 'desc' } },
      },
    });
  }
}
