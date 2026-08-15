import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../common/types/auth-context';
import { sendMessageSchema, type SendMessageInput } from '../cases/cases.schema';
import { DocumentsService, type UploadedFile as MulterFile } from '../documents/documents.service';
import { MessagesService } from '../messages/messages.service';
import { PortalService } from './portal.service';

@Controller('portal')
@Roles(Role.CLIENT)
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly documents: DocumentsService,
    private readonly messages: MessagesService,
  ) {}

  @Get()
  dashboard(@CurrentUser() auth: AuthContext) {
    return this.portal.dashboard(auth);
  }

  @Get('cases/:id')
  case(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.portal.case(auth, id);
  }

  @Get('documents')
  documentsList(@CurrentUser() auth: AuthContext) {
    return this.portal.documents(auth);
  }

  @Post('cases/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() auth: AuthContext,
    @Param('id') caseId: string,
    @UploadedFile() file: MulterFile,
    @Body('requirementId') requirementId?: string,
  ) {
    return this.documents.upload(auth, caseId, file, requirementId || undefined);
  }

  @Get('requests')
  requests(@CurrentUser() auth: AuthContext) {
    return this.portal.requests(auth);
  }

  @Get('messages')
  messageThreads(@CurrentUser() auth: AuthContext) {
    return this.portal.messages(auth);
  }

  @Post('cases/:id/messages')
  sendMessage(
    @CurrentUser() auth: AuthContext,
    @Param('id') caseId: string,
    @Body(zodPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return this.messages.send(auth, caseId, body);
  }
}
