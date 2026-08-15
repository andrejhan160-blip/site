import { Injectable, Logger } from '@nestjs/common';
import type { EnqueueOptions, JobQueue } from './job-queue';
import { JobRegistry } from './job-registry.service';

/**
 * Fallback used when Redis is not configured (tests, single-process demos).
 * Runs handlers in-process without blocking the request that scheduled them.
 */
@Injectable()
export class InlineJobQueue implements JobQueue {
  readonly driver = 'inline' as const;
  private readonly logger = new Logger(InlineJobQueue.name);

  constructor(private readonly registry: JobRegistry) {}

  async enqueue<T>(jobName: string, payload: T, options?: EnqueueOptions): Promise<void> {
    const run = () => {
      this.registry.run(jobName, payload).catch((error: unknown) => {
        this.logger.error(`Inline job "${jobName}" failed`, error instanceof Error ? error.stack : String(error));
      });
    };
    if (options?.delayMs && options.delayMs > 0) {
      setTimeout(run, options.delayMs).unref();
      return;
    }
    setImmediate(run);
  }
}
