import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';
import type { CreateTemplateInput, UpdateTemplateInput } from './workflows.schema';

export const templateInclude = {
  stages: {
    orderBy: { position: 'asc' },
    include: { requirements: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.WorkflowTemplateInclude;

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthContext) {
    return this.prisma.workflowTemplate.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { name: 'asc' },
      include: {
        stages: { orderBy: { position: 'asc' }, include: { _count: { select: { requirements: true } } } },
        _count: { select: { cases: true } },
      },
    });
  }

  async get(auth: AuthContext, id: string) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: templateInclude,
    });
    if (!template) throw new NotFoundException('Воркфлоу не найден');
    return template;
  }

  async create(auth: AuthContext, input: CreateTemplateInput) {
    return this.prisma.workflowTemplate.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        stages: {
          create: input.stages.map((stage, stageIndex) => ({
            name: stage.name,
            description: stage.description,
            position: stageIndex,
            requirements: {
              create: stage.requirements.map((requirement, requirementIndex) => ({
                name: requirement.name,
                description: requirement.description,
                instructions: requirement.instructions,
                required: requirement.required,
                deadlineDays: requirement.deadlineDays ?? null,
                position: requirementIndex,
              })),
            },
          })),
        },
      },
      include: templateInclude,
    });
  }

  /**
   * Replaces the template definition. Existing cases keep their own copied
   * stages and requirements — templates are a blueprint, not a live link.
   */
  async update(auth: AuthContext, id: string, input: UpdateTemplateInput) {
    await this.get(auth, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.workflowTemplate.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
        },
      });

      if (input.stages) {
        await tx.workflowTemplateStage.deleteMany({ where: { templateId: id } });
        for (const [stageIndex, stage] of input.stages.entries()) {
          await tx.workflowTemplateStage.create({
            data: {
              templateId: id,
              name: stage.name,
              description: stage.description,
              position: stageIndex,
              requirements: {
                create: stage.requirements.map((requirement, requirementIndex) => ({
                  name: requirement.name,
                  description: requirement.description,
                  instructions: requirement.instructions,
                  required: requirement.required,
                  deadlineDays: requirement.deadlineDays ?? null,
                  position: requirementIndex,
                })),
              },
            },
          });
        }
      }

      return tx.workflowTemplate.findFirstOrThrow({ where: { id }, include: templateInclude });
    });
  }

  async archive(auth: AuthContext, id: string) {
    await this.get(auth, id);
    return this.prisma.workflowTemplate.update({ where: { id }, data: { isActive: false } });
  }
}
