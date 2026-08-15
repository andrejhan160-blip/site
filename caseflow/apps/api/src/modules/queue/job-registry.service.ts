import { Injectable, Logger } from '@nestjs/common';
import type { JobHandler } from './job-queue';

/**
 * Job name -> handler map. Feature modules register their own handlers, which
 * keeps the queue module free of business dependencies.
 */
@Injectable()
export class JobRegistry {
  private readonly logger = new Logger(JobRegistry.name);
  private readonly handlers = new Map<string, JobHandler>();

  register(jobName: string, handler: JobHandler): void {
    if (this.handlers.has(jobName)) {
      this.logger.warn(`Handler for "${jobName}" was replaced`);
    }
    this.handlers.set(jobName, handler);
  }

  async run(jobName: string, payload: unknown): Promise<void> {
    const handler = this.handlers.get(jobName);
    if (!handler) {
      this.logger.error(`No handler registered for job "${jobName}"`);
      return;
    }
    await handler(payload);
  }
}
