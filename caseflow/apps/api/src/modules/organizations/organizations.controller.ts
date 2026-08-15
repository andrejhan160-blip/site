import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthContext } from '../../common/types/auth-context';
import {
  inviteUserSchema,
  updateOrganizationSchema,
  updateUserSchema,
  type InviteUserInput,
  type UpdateOrganizationInput,
  type UpdateUserInput,
} from './organizations.schema';
import { OrganizationsService } from './organizations.service';

@Controller('organization')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  get(@CurrentUser() auth: AuthContext) {
    return this.organizations.get(auth);
  }

  @Patch()
  @Roles(Role.OWNER, Role.ADMIN)
  update(
    @CurrentUser() auth: AuthContext,
    @Body(zodPipe(updateOrganizationSchema)) body: UpdateOrganizationInput,
  ) {
    return this.organizations.update(auth, body);
  }

  @Get('users')
  listUsers(@CurrentUser() auth: AuthContext) {
    return this.organizations.listUsers(auth);
  }

  @Post('users')
  @Roles(Role.OWNER, Role.ADMIN)
  invite(@CurrentUser() auth: AuthContext, @Body(zodPipe(inviteUserSchema)) body: InviteUserInput) {
    return this.organizations.inviteUser(auth, body);
  }

  @Patch('users/:id')
  @Roles(Role.OWNER, Role.ADMIN)
  updateUser(
    @CurrentUser() auth: AuthContext,
    @Param('id') id: string,
    @Body(zodPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    return this.organizations.updateUser(auth, id, body);
  }
}
