import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaService } from './common/prisma/prisma.service';
import type { AppConfig } from './config/configuration';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Bitrix24 posts form-encoded webhook bodies.
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`CaseFlow API listening on http://localhost:${port}/${config.get('API_PREFIX', { infer: true })}`);
}

void bootstrap();
