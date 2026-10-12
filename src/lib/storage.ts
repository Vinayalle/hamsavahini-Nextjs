/**
 * FILE STORAGE BOUNDARY
 *
 * Future: implement `FileStorage` against the backend, which issues pre-signed S3-compatible upload
 * URLs after authorization and server-side validation (type, size, malware scan). The browser then
 * PUTs the file straight to object storage and the API stores the resulting object key.
 *
 * Current: `localPreviewStorage` only creates a browser-local object URL so editors can preview a
 * file. NOTHING is uploaded anywhere, and the URL stops working on reload.
 */
export interface StoredFile {
  /** Object key the backend would persist. For the preview adapter this is a placeholder. */
  key: string;
  /** URL usable for display. */
  url: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
}

export interface FileStorage {
  upload(file: File): Promise<StoredFile>;
  remove(file: StoredFile): Promise<void>;
}

export const localPreviewStorage: FileStorage = {
  async upload(file) {
    return {
      key: `local-preview/${file.name}`,
      url: URL.createObjectURL(file),
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    };
  },
  async remove(file) {
    if (file.url.startsWith("blob:")) URL.revokeObjectURL(file.url);
  },
};

export const fileStorage: FileStorage = localPreviewStorage;

export interface FileRules {
  accept: string[]; // MIME types
  maxBytes: number;
}

export const IMAGE_RULES: FileRules = { accept: ["image/jpeg", "image/png", "image/webp"], maxBytes: 3 * 1024 * 1024 };
export const DOCUMENT_RULES: FileRules = {
  accept: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  maxBytes: 10 * 1024 * 1024,
};

/** Returns an error message, or null if the file is acceptable. */
export function validateFile(file: File, rules: FileRules): string | null {
  if (!rules.accept.includes(file.type)) {
    return `“${file.name}” is not an allowed file type.`;
  }
  if (file.size > rules.maxBytes) {
    return `“${file.name}” exceeds the ${Math.round(rules.maxBytes / 1024 / 1024)} MB limit.`;
  }
  return null;
}
