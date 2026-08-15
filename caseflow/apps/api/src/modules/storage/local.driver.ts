import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { sign } from '../../common/utils/crypto';
import type { PutObjectInput, StorageDriver, StoredObject } from './storage.driver';

export interface LocalDriverOptions {
  root: string;
  apiUrl: string;
  apiPrefix: string;
  secret: string;
  ttlSeconds: number;
}

/**
 * Filesystem-backed driver for development and self-hosted single-node setups.
 * Downloads still go through signed, expiring URLs so the access model matches
 * the S3 driver exactly.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly logger = new Logger('LocalStorage');

  constructor(private readonly options: LocalDriverOptions) {}

  private absolutePath(key: string): string {
    const root = resolve(this.options.root);
    const target = resolve(join(root, normalize(key)));
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error('Refusing to resolve a storage key outside the storage root');
    }
    return target;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const path = this.absolutePath(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
    this.logger.debug(`Stored ${input.key} (${input.body.byteLength} bytes)`);
    return {
      storageKey: input.key,
      fileSize: input.body.byteLength,
      checksum: createHash('sha256').update(input.body).digest('hex'),
    };
  }

  async signedDownloadUrl(key: string, filename: string): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + this.options.ttlSeconds;
    const signature = sign(`${key}:${expires}`, this.options.secret);
    const params = new URLSearchParams({ key, expires: String(expires), signature, filename });
    return `${this.options.apiUrl}/${this.options.apiPrefix}/files/download?${params.toString()}`;
  }

  verifySignature(key: string, expires: number, signature: string): boolean {
    if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
    return sign(`${key}:${expires}`, this.options.secret) === signature;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.absolutePath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.absolutePath(key), { force: true });
  }
}
