import { Module } from '@nestjs/common';
import { DocumentsController } from '../documents/documents.controller';
import { DocumentsService } from '../documents/documents.service';
import { MessagesService } from '../messages/messages.service';
import { RequestsController } from '../requests/requests.controller';
import { RequestsService } from '../requests/requests.service';
import { TasksController } from '../tasks/tasks.controller';
import { TasksService } from '../tasks/tasks.service';
import { CaseAccessService } from './case-access.service';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

/**
 * The case workspace. Documents, requests, tasks and messages are facets of a
 * case rather than independent aggregates, so they share one module and one
 * authorisation choke point (CaseAccessService).
 */
@Module({
  controllers: [CasesController, DocumentsController, RequestsController, TasksController],
  providers: [
    CaseAccessService,
    CasesService,
    DocumentsService,
    RequestsService,
    TasksService,
    MessagesService,
  ],
  exports: [
    CaseAccessService,
    CasesService,
    DocumentsService,
    RequestsService,
    TasksService,
    MessagesService,
  ],
})
export class CasesModule {}
