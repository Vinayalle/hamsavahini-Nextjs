"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiClientError, apiFetch, isApiMode, refreshSession, setUnauthorizedHandler } from "@/lib/api/client";
import { resetApiCaches } from "@/lib/api/collection";

/**
 * AUTHENTICATION BOUNDARY
 *
 * `useAuth()` is the contract the UI depends on. It has two implementations selected at build time:
 *
 *  - NEXT_PUBLIC_DATA_SOURCE=mock  (default): a DEVELOPMENT-ONLY preview session. It never checks a password, keeps a
 *    non-secret display profile in sessionStorage and provides NO security. It exists so the UI can be previewed without
 *    a backend. It is NOT compiled into the behaviour of api mode: api mode never falls back to it.
 *
 *  - NEXT_PUBLIC_DATA_SOURCE=api: real server-side authentication. Credentials are HttpOnly cookies set by the server
 *    (short-lived access JWT + rotating refresh token); this module only ever holds non-secret identity and a permission
 *    list to shape the UI. The server re-authorizes every request.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId?: string;
}

export interface MfaState {
  /** "email": a code is emailed at every sign-in (default). "totp": authenticator app for admin roles. */
  method?: "email" | "totp";
  enabled: boolean;
  required: boolean;
  recoveryCodesRemaining: number;
}

export type SignInResult = { status: "authenticated" } | { status: "mfa_required"; method: "email" | "totp"; enrolled: boolean; maskedEmail?: string };

export interface AuthService {
  signIn(email: string): SessionUser;
  signOut(): void;
}

const KEY = "hamsavahin.dev-session";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const devAuthService: AuthService = {
  signIn(email) {
    const user: SessionUser = { id: "usr_001", name: "Rahul Varma", email, role: "Super Admin" };
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(user));
    } catch {
      /* storage unavailable: session will not persist */
    }
    emit();
    return user;
  },
  signOut() {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    emit();
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export interface AuthApi {
  user: SessionUser | null;
  /** False until the session state is known (SSR/hydration, or the first /api/auth/me round trip). */
  ready: boolean;
  /** UI hint only. The server enforces permissions on every request. */
  can: (resource: string, action: string) => boolean;
  /** True for a Super Admin (database mode) or the development mock session. */
  isSuperAdmin: boolean;
  /** Second-factor status of the signed-in user (api mode). */
  mfa: MfaState | null;
  /** True after a signed-in session ended without the user asking (expired / revoked). */
  sessionExpired: boolean;
  /** Re-reads identity and permissions from the server (e.g. after the user's own access changed). */
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  /** Second step of sign-in for accounts that require MFA. */
  completeMfa: (input: { code?: string; recoveryCode?: string }) => Promise<void>;
  /** After the server confirms MFA enrolment during sign-in: load the new session. */
  finishSignIn: () => Promise<void>;
  /** Quietly re-establishes a session from the refresh cookie (used when the access token has expired). */
  restoreSession: () => Promise<boolean>;
  /** Ends the session on the server, then clears the UI. */
  signOut: () => Promise<void>;
}

/* ───────────── Development-only mock session (NEXT_PUBLIC_DATA_SOURCE=mock) ───────────── */
function useDevAuth(): AuthApi {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const user = useMemo<SessionUser | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }, [raw]);

  const can = useCallback(() => user?.role === "Super Admin", [user]);
  const signIn = useCallback(async (email: string): Promise<SignInResult> => {
    devAuthService.signIn(email); // password is intentionally ignored: mock only
    return { status: "authenticated" };
  }, []);
  const noop = useCallback(async () => {}, []);
  const restore = useCallback(async () => false, []);
  const signOut = useCallback(async () => devAuthService.signOut(), []);

  return { user, ready, can, isSuperAdmin: user?.role === "Super Admin", mfa: null, sessionExpired: false, refresh: noop, signIn, completeMfa: noop, finishSignIn: noop, restoreSession: restore, signOut };
}

/* ───────────── Real session (NEXT_PUBLIC_DATA_SOURCE=api): HttpOnly cookies + /api/auth/* ───────────── */
interface ApiAuthState {
  status: "unknown" | "authed" | "anon";
  user: SessionUser | null;
  permissions: ReadonlySet<string>;
  isSuperAdmin: boolean;
  mfa: MfaState | null;
  sessionExpired: boolean;
}
const NO_PERMS: ReadonlySet<string> = new Set();
const UNKNOWN: ApiAuthState = { status: "unknown", user: null, permissions: NO_PERMS, isSuperAdmin: false, mfa: null, sessionExpired: false };
const anon = (sessionExpired = false): ApiAuthState => ({ ...UNKNOWN, status: "anon", sessionExpired });
let apiState: ApiAuthState = UNKNOWN;
let bootstrap: Promise<void> | null = null;
let pendingLogout: Promise<unknown> | null = null;
const setApiState = (next: ApiAuthState) => {
  apiState = next;
  emit();
};

async function loadMe(): Promise<boolean> {
  try {
    const me = await apiFetch<{ user: SessionUser; permissions: string[]; isSuperAdmin: boolean; mfa: MfaState }>("/api/auth/me");
    setApiState({ status: "authed", user: me.user, permissions: new Set(me.permissions), isSuperAdmin: me.isSuperAdmin, mfa: me.mfa, sessionExpired: false });
    return true;
  } catch {
    setApiState(anon());
    return false;
  }
}

if (isApiMode && typeof window !== "undefined") {
  // apiFetch already tried a silent refresh; reaching this handler means the server no longer accepts the session.
  setUnauthorizedHandler(() => {
    if (apiState.status === "authed") {
      resetApiCaches();
      setApiState(anon(true));
    }
  });
}

function useApiAuth(): AuthApi {
  const state = useSyncExternalStore(subscribe, () => apiState, () => UNKNOWN);
  useEffect(() => {
    if (state.status === "unknown") bootstrap ??= loadMe().then(() => undefined).finally(() => { bootstrap = null; });
  }, [state.status]);

  const can = useCallback(
    (resource: string, action: string) => state.isSuperAdmin || state.permissions.has(`${resource}:${action}`),
    [state.permissions, state.isSuperAdmin],
  );
  const refresh = useCallback(async () => {
    await loadMe();
  }, []);
  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const r = await apiFetch<{ status: "authenticated" | "mfa_required"; method?: "email" | "totp"; enrolled?: boolean; maskedEmail?: string }>("/api/auth/login", { method: "POST", body: { email, password } });
    if (r.status === "mfa_required") return { status: "mfa_required", method: r.method ?? "totp", enrolled: !!r.enrolled, maskedEmail: r.maskedEmail };
    resetApiCaches();
    await loadMe();
    return { status: "authenticated" };
  }, []);
  const completeMfa = useCallback(async (input: { code?: string; recoveryCode?: string }) => {
    await apiFetch("/api/auth/mfa/verify", { method: "POST", body: input });
    resetApiCaches();
    await loadMe();
  }, []);
  const finishSignIn = useCallback(async () => {
    resetApiCaches();
    await loadMe();
  }, []);
  const restoreSession = useCallback(async () => {
    if (pendingLogout) await pendingLogout.catch(() => undefined); // never resurrect a session that is being ended
    if (!(await refreshSession())) return false;
    resetApiCaches();
    return loadMe();
  }, []);
  const signOut = useCallback(async () => {
    resetApiCaches();
    pendingLogout = apiFetch("/api/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    try {
      await pendingLogout;
    } finally {
      pendingLogout = null;
      setApiState(anon());
    }
  }, []);

  return { user: state.user, ready: state.status !== "unknown", can, isSuperAdmin: state.isSuperAdmin, mfa: state.mfa, sessionExpired: state.sessionExpired, refresh, signIn, completeMfa, finishSignIn, restoreSession, signOut };
}

export const useAuth: () => AuthApi = isApiMode ? useApiAuth : useDevAuth;
export { ApiClientError };
