import { Controller, ForbiddenException, Get, Inject, NotFoundException, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Public } from '../../common/decorators';
import { zodPipe } from '../../common/pipes/zod-validation.pipe';
import { LocalStorageDriver } from './local.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';

const downloadQuery = z.object({
  key: z.string().min(1),
  expires: z.coerce.number().int(),
  signature: z.string().min(1),
  filename: z.string().default('document'),
});

/**
 * Serves signed downloads for the local driver. The route is public by design:
 * authorisation is carried by the HMAC signature and its expiry, exactly like an
 * S3 presigned URL. With the S3 driver this route is never issued.
 */
@Controller('files')
export class FilesController {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  @Public()
  @Get('download')
  async download(@Query(zodPipe(downloadQuery)) query: z.infer<typeof downloadQuery>, @Res() res: Response) {
    if (!(this.driver instanceof LocalStorageDriver)) {
      throw new NotFoundException('Недоступно для этого драйвера хранилища');
    }
    if (!this.driver.verifySignature(query.key, query.expires, query.signature)) {
      throw new ForbiddenException('Ссылка на скачивание недействительна или истекла');
    }

    let body: Buffer;
    try {
      body = await this.driver.get(query.key);
    } catch {
      throw new NotFoundException('Файл не найден');
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(query.filename)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(body);
  }
}
