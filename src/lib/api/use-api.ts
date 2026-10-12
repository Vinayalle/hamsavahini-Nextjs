"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, apiFetch } from "./client";

export interface ApiState<T> {
  data: T | undefined;
  error: ApiClientError | undefined;
  loading: boolean;
  reload: () => Promise<void>;
  /** Replace the cached value (e.g. with a mutation response) without refetching. */
  set: (value: T) => void;
}

/** Minimal GET hook for the admin screens. Pass `null` to skip. Re-fetches when `path` changes. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiClientError | undefined>(undefined);
  const [loading, setLoading] = useState(path !== null);
  const alive = useRef(true);

  const run = useCallback(async () => {
    if (path === null) return;
    setLoading(true);
    try {
      const res = await apiFetch<T>(path);
      if (!alive.current) return;
      setData(res);
      setError(undefined);
    } catch (e) {
      if (alive.current) setError(e instanceof ApiClientError ? e : new ApiClientError("Failed to load", 0, "error"));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  return { data, error, loading, reload: run, set: setData };
}
