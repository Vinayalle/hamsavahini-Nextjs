import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "./errors";

/**
 * UPLOAD VALIDATION. The browser's file name and MIME type are never trusted: the type is decided from the file's own bytes
 * (magic numbers), must be on an allow-list, and must agree with what the client declared. Scripts, HTML and SVG are not
 * on the list. Sizes are capped per kind. Names are sanitised for display and never used in the storage key.
 */
export type FileKind = "image" | "video" | "document";

export interface Detected {
  mime: string;
  ext: string;
  kind: FileKind;
  width?: number;
  height?: number;
}

export const LIMITS: Record<FileKind, number> = {
  image: 5 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  document: 10 * 1024 * 1024,
};

const startsWith = (b: Buffer, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Buffer, start: number, end: number) => b.toString("latin1", start, end);

function pngSize(b: Buffer) {
  return b.length >= 24 ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : {};
}
function jpegSize(b: Buffer) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return {};
}
function webpSize(b: Buffer) {
  const chunk = ascii(b, 12, 16);
  if (chunk === "VP8X" && b.length >= 30) return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8 " && b.length >= 30) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L" && b.length >= 25) { const v = b.readUInt32LE(21); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
  return {};
}

/** Identifies a file from its bytes, or null if it is not an allowed type. */
export function detectFile(b: Buffer, extension: string): Detected | null {
  if (b.length < 12) return null;
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", kind: "image", ...pngSize(b) };
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", kind: "image", ...jpegSize(b) };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image", ...webpSize(b) };
  if (ascii(b, 4, 8) === "ftyp" && ["mp41", "mp42", "isom", "avc1", "iso2", "M4V "].includes(ascii(b, 8, 12))) return { mime: "video/mp4", ext: "mp4", kind: "video" };
  if (ascii(b, 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf", kind: "document" };
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    // Legacy OLE container: Word or Excel, told apart by the extension (the bytes alone cannot).
    if (extension === "xls") return { mime: "application/vnd.ms-excel", ext: "xls", kind: "document" };
    if (extension === "doc") return { mime: "application/msword", ext: "doc", kind: "document" };
    return null;
  }
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
    // OOXML is a zip: it must really contain a Word or Excel package, not just any archive.
    const head = b.toString("latin1", 0, Math.min(b.length, 64 * 1024));
    if (head.includes("word/")) return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", kind: "document" };
    if (head.includes("xl/")) return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", kind: "document" };
  }
  return null;
}

/** Display-safe file name: no path, no control characters, bounded length. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "file";
}

export interface ValidatedUpload extends Detected {
  bytes: Buffer;
  originalName: string;
  sha256: string;
  size: number;
}

/**
 * Validates an uploaded File against the allowed kinds. Throws ApiErrors with safe messages:
 * 413 too large, 415 type not allowed / content does not match what was declared, 422 empty.
 */
export async function validateUpload(file: File, allowed: FileKind[]): Promise<ValidatedUpload> {
  if (file.size === 0) throw new ApiError(422, "empty_file", "The file is empty");
  const maxAny = Math.max(...allowed.map((k) => LIMITS[k]));
  if (file.size > maxAny) throw new ApiError(413, "file_too_large", `The file is too large (maximum ${Math.round(maxAny / 1024 / 1024)} MB)`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = cleanFileName(file.name);
  const extension = (originalName.split(".").pop() ?? "").toLowerCase();
  const detected = detectFile(bytes, extension);
  if (!detected || !allowed.includes(detected.kind)) throw new ApiError(415, "file_type_not_allowed", "This file type is not allowed");
  if (file.type && file.type !== detected.mime && !(detected.kind === "document" && file.type === "application/octet-stream")) {
    throw new ApiError(415, "file_type_mismatch", "The file's content does not match its declared type");
  }
  if (bytes.length > LIMITS[detected.kind]) throw new ApiError(413, "file_too_large", `The file is too large (maximum ${Math.round(LIMITS[detected.kind] / 1024 / 1024)} MB for this type)`);
  return { ...detected, bytes, originalName, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** Random object key: area/YYYY/uuid.ext (the original name never reaches the key). */
export function newStorageKey(area: "media" | "documents", ext: string): string {
  return `${area}/${new Date().getUTCFullYear()}/${randomUUID()}.${ext}`;
}
