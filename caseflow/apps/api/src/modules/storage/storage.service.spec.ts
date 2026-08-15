import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import type { StorageDriver } from './storage.driver';
import { StorageService } from './storage.service';

const config = {
  get: (key: string) =>
    ({
      UPLOAD_MAX_BYTES: 1024,
      UPLOAD_ALLOWED_MIME: 'application/pdf,image/png',
    })[key],
} as unknown as ConfigService<AppConfig, true>;

const driver = { name: 'local' } as unknown as StorageDriver;

describe('StorageService validation', () => {
  const service = new StorageService(driver, config);

  it('accepts an allowed type within the size limit', () => {
    expect(() => service.validate({ originalname: 'passport.pdf', mimetype: 'application/pdf', size: 500 })).not.toThrow();
  });

  it('rejects an oversized file', () => {
    expect(() => service.validate({ originalname: 'passport.pdf', mimetype: 'application/pdf', size: 2048 })).toThrow(
      PayloadTooLargeException,
    );
  });

  it('rejects a disallowed MIME type', () => {
    expect(() => service.validate({ originalname: 'run.exe', mimetype: 'application/x-msdownload', size: 10 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a mismatched extension even when the MIME type is allowed', () => {
    expect(() => service.validate({ originalname: 'payload.exe', mimetype: 'application/pdf', size: 10 })).toThrow(
      BadRequestException,
    );
  });

  it('namespaces object keys by tenant and never uses sequential ids', () => {
    const first = service.buildKey('org-1', 'case-1', 'passport.pdf');
    const second = service.buildKey('org-1', 'case-1', 'passport.pdf');
    expect(first).toMatch(/^org\/org-1\/cases\/case-1\/[0-9a-f-]{36}\.pdf$/);
    expect(first).not.toBe(second);
  });
});
