import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../common/types/auth-context';
import { DocumentsService, type UploadedFile as MulterFile } from '../documents/documents.service';
import { EventsService } from '../events/events.service';
import { MessagesService } from '../messages/messages.service';
import { RequestsService } from '../requests/requests.service';
import { TasksService } from '../tasks/tasks.service';
import { CasesService } from './cases.service';
import {
  changeStageSchema,
  createCaseSchema,
  createRequestSchema,
  createTaskSchema,
  listCasesSchema,
  requestDocumentSchema,
  sendMessageSchema,
  updateCaseSchema,
  type ChangeStageInput,
  type CreateCaseInput,
  type CreateRequestInput,
  type CreateTaskInput,
  type ListCasesQuery,
  type RequestDocumentInput,
  type SendMessageInput,
  type UpdateCaseInput,
} from './cases.schema';

@Controller('cases')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly documents: DocumentsService,
    private readonly requests: RequestsService,
    private readonly tasks: TasksService,
    private readonly messages: MessagesService,
    private readonly events: EventsService,
  ) {}

  @Get()
  list(@CurrentUser() auth: AuthContext, @Query(zodPipe(listCasesSchema)) query: ListCasesQuery) {
    return this.cases.list(auth, query);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  create(@CurrentUser() auth: AuthContext, @Body(zodPipe(createCaseSchema)) body: CreateCaseInput) {
    return this.cases.create(auth, body);
  }

  @Get(':id')
  get(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.cases.get(auth, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(updateCaseSchema)) body: UpdateCaseInput,
  ) {
    return this.cases.update(auth, id, body);
  }

  @Post(':id/stage')
  changeStage(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(changeStageSchema)) body: ChangeStageInput,
  ) {
    return this.cases.changeStage(auth, id, body);
  }

  @Get(':id/activity')
  activity(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.events.listForCase(auth.organizationId, id);
  }

  // --- Documents -----------------------------------------------------------

  @Post(':id/document-requests')
  requestDocument(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(requestDocumentSchema)) body: RequestDocumentInput,
  ) {
    return this.documents.requestDocument(auth, id, body);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @Body('requirementId') requirementId?: string,
  ) {
    return this.documents.upload(auth, id, file, requirementId || undefined);
  }

  // --- Requests ------------------------------------------------------------

  @Post(':id/requests')
  createRequest(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(createRequestSchema)) body: CreateRequestInput,
  ) {
    return this.requests.create(auth, id, body);
  }

  // --- Tasks ---------------------------------------------------------------

  @Post(':id/tasks')
  createTask(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.tasks.create(auth, id, body);
  }

  // --- Messages ------------------------------------------------------------

  @Get(':id/messages')
  listMessages(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.messages.list(auth, id);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return this.messages.send(auth, id, body);
  }
}
