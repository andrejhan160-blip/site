import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import type { AppConfig } from '../../config/configuration';
import { QUEUE_NAME, type EnqueueOptions, type JobQueue } from './job-queue';
import { JobRegistry } from './job-registry.service';

@Injectable()
export class RedisJobQueue implements JobQueue, OnModuleInit, OnModuleDestroy {
  readonly driver = 'redis' as const;
  private readonly logger = new Logger(RedisJobQueue.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly registry: JobRegistry,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.config.get('REDIS_URL', { infer: true }) };
    this.queue = new Queue(QUEUE_NAME, { connection });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        await this.registry.run(job.name, job.data);
      },
      { connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job "${job?.name}" failed: ${error.message}`);
    });
    this.logger.log(`BullMQ worker listening on queue "${QUEUE_NAME}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue<T>(jobName: string, payload: T, options?: EnqueueOptions): Promise<void> {
    if (!this.queue) throw new Error('Queue not initialised');
    const jobOptions: JobsOptions = {
      jobId: options?.jobId,
      delay: options?.delayMs,
      attempts: options?.attempts ?? 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    };
    await this.queue.add(jobName, payload, jobOptions);
  }
}
