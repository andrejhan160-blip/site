import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventType, Role, TaskStatus, TaskVisibility } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import { CaseAccessService } from '../cases/case-access.service';
import type { CreateTaskInput, UpdateTaskInput } from '../cases/cases.schema';
import { EventsService } from '../events/events.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessService,
    private readonly events: EventsService,
  ) {}

  async create(auth: AuthContext, caseId: string, input: CreateTaskInput) {
    this.access.assertStaff(auth);
    await this.access.assertAccess(auth, caseId);

    if (input.assignedToId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: input.assignedToId, organizationId: auth.organizationId, role: { not: Role.CLIENT } },
      });
      if (!assignee) throw new BadRequestException('Assigned employee not found');
    }

    const task = await this.prisma.task.create({
      data: {
        organizationId: auth.organizationId,
        caseId,
        title: input.title,
        description: input.description,
        assignedToId: input.assignedToId ?? auth.userId,
        deadline: input.deadline,
        visibility: input.visibility,
        status: TaskStatus.OPEN,
      },
    });

    await this.events.recordAs(auth, {
      caseId,
      eventType: EventType.TASK_CREATED,
      payload: { taskId: task.id, title: task.title, visibility: task.visibility },
    });

    return task;
  }

  async update(auth: AuthContext, taskId: string, input: UpdateTaskInput) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: auth.organizationId },
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.access.assertAccess(auth, task.caseId);

    // A client may only tick off a task that was shared with them.
    if (auth.role === Role.CLIENT) {
      const clientMayComplete =
        task.visibility !== TaskVisibility.INTERNAL &&
        Object.keys(input).length === 1 &&
        input.status === TaskStatus.COMPLETED;
      if (!clientMayComplete) throw new BadRequestException('This task cannot be changed from the portal');
    }

    const completing = input.status === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED;

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        ...input,
        completedAt: completing ? new Date() : input.status ? null : task.completedAt,
      },
    });

    if (completing) {
      await this.events.recordAs(auth, {
        caseId: task.caseId,
        eventType: EventType.TASK_COMPLETED,
        payload: { taskId: task.id, title: task.title },
      });
    }

    return updated;
  }

  async listForClient(auth: AuthContext) {
    return this.prisma.task.findMany({
      where: {
        organizationId: auth.organizationId,
        visibility: { in: [TaskVisibility.CLIENT, TaskVisibility.BOTH] },
        case: { clientId: auth.clientId ?? '__no_client__' },
      },
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
      include: { case: { select: { id: true, title: true } } },
    });
  }
}
