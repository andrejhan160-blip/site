import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { FilesController } from './files.controller';
import { LocalStorageDriver } from './local.driver';
import { S3StorageDriver } from './s3.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): StorageDriver => {
        const ttlSeconds = config.get('SIGNED_URL_TTL_SECONDS', { infer: true });
        if (config.get('STORAGE_DRIVER', { infer: true }) === 's3') {
          const bucket = config.get('S3_BUCKET', { infer: true });
          if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
          return new S3StorageDriver({
            bucket,
            region: config.get('S3_REGION', { infer: true }),
            endpoint: config.get('S3_ENDPOINT', { infer: true }),
            accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
            secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
            ttlSeconds,
          });
        }
        return new LocalStorageDriver({
          root: config.get('STORAGE_LOCAL_PATH', { infer: true }),
          apiUrl: config.get('API_URL', { infer: true }),
          apiPrefix: config.get('API_PREFIX', { infer: true }),
          secret: config.get('SESSION_SECRET', { infer: true }),
          ttlSeconds,
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_DRIVER],
})
export class StorageModule {}
