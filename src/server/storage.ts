import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { getStorageConfig } from "./config";

/**
 * OBJECT STORAGE (S3 or any S3-compatible service).
 *
 * Files (resumes, media, documents) live in a PRIVATE bucket, never in the database and never on the web server's disk.
 * The bucket must have "block public access" on; the app is the only reader, either streaming through an authorized route
 * or minting a short-lived signed URL after a permission check. Object keys are random (never derived from the file name).
 *
 * `getStorage()` is null until S3_* variables are set; callers then answer 503 `storage_not_configured` AFTER authorizing
 * the caller. Nothing pretends to store or serve a file that was not stored.
 */
export interface StoredObject {
  stream: ReadableStream<Uint8Array>;
  contentType?: string;
  contentLength?: number;
}

export interface ObjectStorage {
  put(key: string, body: Buffer, opts: { contentType: string }): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  /** A time-limited URL for downloading one stored object, forcing a download with the given file name. */
  signedDownloadUrl(key: string, opts: { fileName: string; expiresInSeconds: number }): Promise<string>;
}

/** Content-Disposition value that is safe for any file name (RFC 6266 / 5987). */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function createS3Storage(cfg: NonNullable<ReturnType<typeof getStorageConfig>>): ObjectStorage {
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    // Several S3-compatible services reject the newer default trailing checksums.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
  });
  const Bucket = cfg.bucket;
  return {
    async put(key, body, { contentType }) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType, ContentLength: body.length, CacheControl: "private, no-store" }));
    },
    async get(key) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!r.Body) throw new Error("Empty object body");
      const body = r.Body as Readable & { transformToWebStream?: () => ReadableStream<Uint8Array> };
      return { stream: body.transformToWebStream ? body.transformToWebStream() : (await import("node:stream")).Readable.toWeb(body) as ReadableStream<Uint8Array>, contentType: r.ContentType, contentLength: r.ContentLength };
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    signedDownloadUrl(key, { fileName, expiresInSeconds }) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key, ResponseContentDisposition: attachmentDisposition(fileName) }), { expiresIn: expiresInSeconds });
    },
  };
}

let override: ObjectStorage | null | undefined;
let cached: ObjectStorage | null | undefined;

/** Test hook: force a storage implementation (or null), or pass undefined to re-read the environment. */
export function setStorageForTests(storage: ObjectStorage | null | undefined) {
  override = storage;
  cached = undefined;
}

export function getStorage(): ObjectStorage | null {
  if (override !== undefined) return override;
  if (cached !== undefined) return cached;
  const cfg = getStorageConfig();
  cached = cfg ? createS3Storage(cfg) : null;
  return cached;
}

export const isStorageConfigured = () => getStorage() !== null;
