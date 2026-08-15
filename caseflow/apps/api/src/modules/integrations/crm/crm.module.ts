import { Module } from '@nestjs/common';
import { CasesModule } from '../../cases/cases.module';
import { CrmController } from './crm.controller';
import { CrmProviderRegistry } from './crm-provider.registry';
import { CrmService } from './crm.service';
import { CrmWebhookService } from './crm-webhook.service';
import { Bitrix24Provider } from './providers/bitrix24.provider';
import { NoCrmProvider } from './providers/no-crm.provider';

@Module({
  imports: [CasesModule],
  controllers: [CrmController],
  providers: [Bitrix24Provider, NoCrmProvider, CrmProviderRegistry, CrmService, CrmWebhookService],
  exports: [CrmService, CrmProviderRegistry],
})
export class CrmModule {}
