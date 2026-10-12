/**
 * Browser-side HTTP client for the backend API.
 *  - Credentials live ONLY in HttpOnly cookies; no token ever touches JavaScript, localStorage or sessionStorage.
 *  - A 401 on an ordinary request triggers ONE silent token refresh (single-flight across the page) and a retry.
 *    Only if that fails is the user treated as signed out.
 *  - A `reauth_required` response opens the re-authentication prompt (step-up) and retries once when confirmed.
 *  - Errors are normalised into ApiClientError so forms can map server field errors.
 */
export const DATA_SOURCE: "mock" | "api" = process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api" : "mock";
export const isApiMode = DATA_SOURCE === "api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields?: Record<string, string>,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

type Unauthorized = () => void;
let onUnauthorized: Unauthorized = () => {};
/** The auth store registers here so a failed refresh signs the user out of the UI. */
export function setUnauthorizedHandler(fn: Unauthorized) {
  onUnauthorized = fn;
}

type Reauth = () => Promise<boolean>;
let reauthHandler: Reauth | null = null;
/** The re-authentication dialog registers here. */
export function setReauthHandler(fn: Reauth | null) {
  reauthHandler = fn;
}

/** Endpoints that manage the session themselves: a 401 from them must not trigger refresh-and-retry. */
const SELF_MANAGED = /^\/api\/auth\/(login|refresh|logout|mfa\/(verify|enroll)|activate|password|verification|reauth)/;

let refreshing: Promise<boolean> | null = null;
/** Rotates the session tokens (cookies are updated by the response). Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.ok) return true;
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      if (body?.error?.code === "refresh_conflict") {
        // Another tab rotated the token a moment ago and already stored the new cookies: just retry.
        await new Promise((r) => setTimeout(r, 400));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

interface Init {
  method?: string;
  /** JSON-serialisable value, or FormData for file uploads (sent as multipart, no manual Content-Type). */
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, init: Init = {}, _retry: { refreshed?: boolean; reauthed?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body !== undefined && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body: init.body === undefined ? undefined : init.body instanceof FormData ? init.body : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch {
    throw new ApiClientError("Cannot reach the server. Check your connection and try again.", 0, "network");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    if (res.status === 401 && !SELF_MANAGED.test(path) && !_retry.refreshed) {
      if (await refreshSession()) return apiFetch<T>(path, init, { ..._retry, refreshed: true });
    }
    if (res.status === 401 && !SELF_MANAGED.test(path)) onUnauthorized();
    if (res.status === 403 && err?.code === "reauth_required" && reauthHandler && !_retry.reauthed) {
      if (await reauthHandler()) return apiFetch<T>(path, init, { ..._retry, reauthed: true });
    }
    const retryAfter = Number(res.headers.get("retry-after")) || undefined;
    throw new ApiClientError(err?.message ?? `Request failed (${res.status})`, res.status, err?.code ?? "error", err?.fields, retryAfter);
  }
  return data as T;
}
