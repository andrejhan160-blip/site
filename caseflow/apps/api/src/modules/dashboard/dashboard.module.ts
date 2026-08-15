import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [CasesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
