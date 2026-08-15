import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role, TaskStatus } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CaseAccessService } from '../cases/case-access.service';
import { updateTaskSchema, type UpdateTaskInput } from '../cases/cases.schema';
import { TasksService } from './tasks.service';

const listTasksQuery = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  mine: z.coerce.boolean().default(false),
});

@Controller('tasks')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST, Role.CLIENT)
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
  ) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
  list(@CurrentUser() auth: AuthContext, @Query(zodPipe(listTasksQuery)) query: z.infer<typeof listTasksQuery>) {
    return this.prisma.task.findMany({
      where: {
        organizationId: auth.organizationId,
        case: this.access.scope(auth),
        ...(query.status ? { status: query.status } : {}),
        ...(query.mine ? { assignedToId: auth.userId } : {}),
      },
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
      include: { case: { select: { id: true, title: true } }, assignedTo: { select: { id: true, name: true } } },
      take: 100,
    });
  }

  @Patch(':id')
  update(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.tasks.update(auth, id, body);
  }
}
