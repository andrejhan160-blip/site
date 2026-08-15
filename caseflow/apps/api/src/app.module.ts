import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { SessionGuard } from './common/guards/session.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { loadConfiguration, type AppConfig } from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { CrmModule } from './modules/integrations/crm/crm.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PortalModule } from './modules/portal/portal.module';
import { QueueModule } from './modules/queue/queue.module';
import { StorageModule } from './modules/storage/storage.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: () => loadConfiguration() }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('RATE_LIMIT_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('RATE_LIMIT_LIMIT', { infer: true }),
          },
          { name: 'auth', ttl: 60_000, limit: config.get('AUTH_RATE_LIMIT', { infer: true }) },
          { name: 'webhook', ttl: 60_000, limit: 300 },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    StorageModule,
    EventsModule,
    NotificationsModule,
    AuthModule,
    OrganizationsModule,
    ClientsModule,
    WorkflowsModule,
    CasesModule,
    DashboardModule,
    PortalModule,
    CrmModule,
    MaintenanceModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
