import { Controller, Post, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { RequestsService } from './requests.service';

@Controller('requests')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST, Role.CLIENT)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post(':id/complete')
  complete(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.requests.complete(auth, id);
  }

  @Post(':id/cancel')
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
  cancel(@CurrentUser() auth: AuthContext, @Param('id') id: string) {
    return this.requests.cancel(auth, id);
  }
}
