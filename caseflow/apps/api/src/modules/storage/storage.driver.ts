export interface StoredObject {
  storageKey: string;
  fileSize: number;
  checksum: string;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  mimeType: string;
  filename: string;
}

/**
 * Object storage abstraction. Buckets are always private; downloads are handed
 * out as short-lived signed URLs, never as public object paths.
 */
export interface StorageDriver {
  readonly name: 's3' | 'local';
  put(input: PutObjectInput): Promise<StoredObject>;
  signedDownloadUrl(key: string, filename: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
