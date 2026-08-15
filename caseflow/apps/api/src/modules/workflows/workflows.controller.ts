import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../common/types/auth-context';
import {
  createTemplateSchema,
  updateTemplateSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from './workflows.schema';
import { WorkflowsService } from './workflows.service';

@Controller('workflow-templates')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext) {
    return this.workflows.list(auth);
  }

  @Get(':id')
  get(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.workflows.get(auth, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  create(@CurrentUser() auth: AuthContext, @Body(zodPipe(createTemplateSchema)) body: CreateTemplateInput) {
    return this.workflows.create(auth, body);
  }

  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(updateTemplateSchema)) body: UpdateTemplateInput,
  ) {
    return this.workflows.update(auth, id, body);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  archive(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.workflows.archive(auth, id);
  }
}
