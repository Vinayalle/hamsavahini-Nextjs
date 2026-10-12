"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/fields";

/** Six-digit code field: numeric keypad on phones, one-time-code autofill, tolerates pasted spaces/dashes. */
export function CodeInput({ id, value, onChange, autoFocus, length = 6 }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; length?: number }) {
  const display = value.length > 3 ? `${value.slice(0, 3)} ${value.slice(3)}` : value;
  return (
    <Input
      id={id}
      value={display}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      maxLength={length + 1}
      placeholder={"000 000".slice(0, length + 1)}
      aria-label="Verification code"
      className="h-11 text-center font-mono text-lg tracking-[0.35em]"
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
    />
  );
}

/** Counts down from `seconds` after `start()`; used for the resend cooldown. */
export function useCooldown() {
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const start = useCallback((seconds: number) => {
    stop();
    setLeft(seconds);
    timer.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          stop();
          return 0;
        }
        return l - 1;
      });
    }, 1000);
  }, []);
  useEffect(() => stop, []);
  return { left, start };
}
