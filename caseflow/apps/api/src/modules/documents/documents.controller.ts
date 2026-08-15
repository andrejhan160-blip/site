import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../common/types/auth-context';
import { reviewDocumentSchema, type ReviewDocumentInput } from '../cases/cases.schema';
import { DocumentsService } from './documents.service';

@Controller('documents')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST, Role.CLIENT)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('review-queue')
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
  reviewQueue(@CurrentUser() auth: AuthContext) {
    return this.documents.listForReview(auth);
  }

  @Get(':id/download-url')
  downloadUrl(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.documents.downloadUrl(auth, id);
  }

  @Post(':id/review')
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
  review(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(reviewDocumentSchema)) body: ReviewDocumentInput,
  ) {
    return this.documents.review(auth, id, body);
  }
}
