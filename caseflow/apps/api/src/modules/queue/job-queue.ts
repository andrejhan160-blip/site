export const JOB_QUEUE = Symbol('JOB_QUEUE');
export const QUEUE_NAME = 'caseflow';

export interface EnqueueOptions {
  /** Stable id used to collapse duplicate jobs (idempotent enqueues). */
  jobId?: string;
  delayMs?: number;
  attempts?: number;
}

export interface JobQueue {
  readonly driver: 'redis' | 'inline';
  enqueue<T>(jobName: string, payload: T, options?: EnqueueOptions): Promise<void>;
}

export type JobHandler = (payload: unknown) => Promise<void>;
