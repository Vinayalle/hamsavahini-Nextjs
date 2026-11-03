import { join, resolve } from "node:path";

/**
 * Where uploaded files live on disk. One place, used by the upload code, the file routes and the cleanup job (no server-only import,
 * so a command-line script can use it as well).
 *   media, documents, resumes   <project>/uploads/{media,documents,resumes}   (override the root with UPLOAD_DIR)
 *   product pictures/documents  <project>/uploads/products                     (PRODUCT_UPLOAD_DIR)
 */
export const uploadRoot = () => resolve(process.env.UPLOAD_DIR?.trim() || join(/*turbopackIgnore: true*/ process.cwd(), "uploads"));
export const productDir = () => resolve(process.env.PRODUCT_UPLOAD_DIR?.trim() || join(/*turbopackIgnore: true*/ process.cwd(), "uploads", "products"));
