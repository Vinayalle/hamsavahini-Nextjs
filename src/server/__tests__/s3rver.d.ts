// s3rver (a local S3-compatible server used only by the storage tests) ships without type declarations.
declare module "s3rver" {
  export default class S3rver {
    constructor(options: { port?: number; address?: string; silent?: boolean; directory: string; configureBuckets?: { name: string; configs: unknown[] }[] });
    run(): Promise<unknown>;
    close(): Promise<void>;
  }
}
