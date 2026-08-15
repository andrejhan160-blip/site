import { BadRequestException, Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { AppConfig } from '../../config/configuration';
import { STORAGE_DRIVER, type StorageDriver, type StoredObject } from './storage.driver';

export interface UploadInput {
  organizationId: string;
  caseId: string;
  filename: string;
  mimeType: string;
  body: Buffer;
}

const SAFE_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.webp',
  '.doc',
  '.docx',
]);

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  get driverName(): string {
    return this.driver.name;
  }

  get maxBytes(): number {
    return this.config.get('UPLOAD_MAX_BYTES', { infer: true });
  }

  get allowedMimeTypes(): string[] {
    return this.config
      .get('UPLOAD_ALLOWED_MIME', { infer: true })
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  /** Validates size, MIME type and extension before anything touches storage. */
  validate(file: { originalname: string; mimetype: string; size: number }): void {
    if (file.size <= 0) throw new BadRequestException('File is empty');
    if (file.size > this.maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds the ${Math.round(this.maxBytes / (1024 * 1024))} MB limit`,
      );
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }
    const extension = extname(file.originalname).toLowerCase();
    if (!SAFE_EXTENSIONS.has(extension)) {
      throw new BadRequestException(`File extension ${extension || '(none)'} is not allowed`);
    }
  }

  /**
   * Object keys are namespaced by tenant and randomised — never sequential — so
   * a key cannot be guessed from another tenant's key.
   */
  buildKey(organizationId: string, caseId: string, filename: string): string {
    const extension = extname(filename).toLowerCase();
    return `org/${organizationId}/cases/${caseId}/${randomUUID()}${extension}`;
  }

  async upload(input: UploadInput): Promise<StoredObject> {
    const key = this.buildKey(input.organizationId, input.caseId, input.filename);
    return this.driver.put({
      key,
      body: input.body,
      mimeType: input.mimeType,
      filename: input.filename,
    });
  }

  async signedUrl(storageKey: string, filename: string): Promise<string> {
    return this.driver.signedDownloadUrl(storageKey, filename);
  }

  async read(storageKey: string): Promise<Buffer> {
    return this.driver.get(storageKey);
  }
}
