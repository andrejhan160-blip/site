import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext } from '../../common/types/auth-context';

const listQuery = z.object({ unreadOnly: z.coerce.boolean().default(false) });

@Controller('notifications')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST, Role.CLIENT)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() auth: AuthContext, @Query(zodPipe(listQuery)) query: z.infer<typeof listQuery>) {
    const items = await this.prisma.notification.findMany({
      where: {
        organizationId: auth.organizationId,
        userId: auth.userId,
        channel: 'IN_APP',
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unread = await this.prisma.notification.count({
      where: { organizationId: auth.organizationId, userId: auth.userId, channel: 'IN_APP', readAt: null },
    });
    return { items, unread };
  }

  @Post(':id/read')
  async markRead(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    await this.prisma.notification.updateMany({
      where: { id, organizationId: auth.organizationId, userId: auth.userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() auth: AuthContext) {
    await this.prisma.notification.updateMany({
      where: { organizationId: auth.organizationId, userId: auth.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
