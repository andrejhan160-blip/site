import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import type { AuthContext } from '../../common/types/auth-context';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.SPECIALIST)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview(@CurrentUser() auth: AuthContext) {
    return this.dashboard.overview(auth);
  }
}
