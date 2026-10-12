import "server-only";

/** Error with an HTTP status and a stable machine code. Safe to show to the client. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const errors = {
  unauthenticated: () => new ApiError(401, "unauthenticated", "Sign in required"),
  forbidden: () => new ApiError(403, "forbidden", "You do not have permission to do that"),
  notFound: (what = "Record") => new ApiError(404, "not_found", `${what} not found`),
  conflict: (message: string, fields?: Record<string, string>) => new ApiError(409, "conflict", message, fields),
  invalid: (message: string, fields?: Record<string, string>) => new ApiError(422, "validation_failed", message, fields),
  /** Delegation / hierarchy violations: the actor lacks the AUTHORITY, not just the permission. */
  delegation: (message: string, fields?: Record<string, string>) => new ApiError(403, "delegation_exceeded", message, fields),
  tooMany: (retryAfterSeconds?: number) =>
    new ApiError(429, "rate_limited", "Too many attempts. Try again later.", undefined, retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined),
  /** Credentials were right but a recent re-entry of them is required for this sensitive operation. */
  reauth: () => new ApiError(403, "reauth_required", "Confirm your identity to continue"),
};
