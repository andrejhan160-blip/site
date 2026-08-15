import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { InlineJobQueue } from './inline-job-queue';
import { JOB_QUEUE, type JobQueue } from './job-queue';
import { JobRegistry } from './job-registry.service';
import { RedisJobQueue } from './redis-job-queue';

@Global()
@Module({
  providers: [
    JobRegistry,
    {
      // Only the selected driver is instantiated, so a deployment without Redis
      // never opens a connection to it.
      provide: JOB_QUEUE,
      inject: [ConfigService, JobRegistry],
      useFactory: (config: ConfigService<AppConfig, true>, registry: JobRegistry): JobQueue =>
        config.get('QUEUE_ENABLED', { infer: true })
          ? new RedisJobQueue(config, registry)
          : new InlineJobQueue(registry),
    },
  ],
  exports: [JOB_QUEUE, JobRegistry],
})
export class QueueModule {}
