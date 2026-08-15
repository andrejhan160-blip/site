import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [CasesModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
