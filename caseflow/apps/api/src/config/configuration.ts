import { z } from 'zod';

/**
 * Environment schema. The process refuses to boot with an invalid configuration
 * so misconfiguration fails loudly at deploy time rather than at request time.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api'),

  DATABASE_URL: z.string().min(1),

  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().default('cf_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(72),
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(15),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  QUEUE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  UPLOAD_ALLOWED_MIME: z
    .string()
    .default(
      'application/pdf,image/jpeg,image/png,image/heic,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),

  MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  MAIL_FROM: z.string().default('CaseFlow <no-reply@caseflow.app>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfiguration(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const CONFIG_NAMESPACE = 'app';
