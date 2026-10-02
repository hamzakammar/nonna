"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Fetch an /api route. A 501 (another lane hasn't built it yet) becomes
 * `status: "cooking"` so panels show a friendly card instead of crashing.
 */
export type ApiState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "cooking"; message: string }
  | { status: "error"; message: string };

/**
 * With `sample`, a 501 shows the sample data instead (`isSample: true`), so the
 * screen can be built and demoed before the backend exists.
 */
export function useApi<T>(path: string, opts: { pollMs?: number; sample?: T } = {}): ApiState<T> & { reload: () => void; isSample: boolean } {
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(path, { cache: "no-store" })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!alive) return;
          if (res.ok) setState({ status: "ok", data: body as T });
          else if (res.status === 501) setState({ status: "cooking", message: String(body.error ?? "Coming soon") });
          else setState({ status: "error", message: String(body.error ?? res.statusText) });
        })
        .catch((err: unknown) => {
          if (alive) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        });
    load();
    const timer = opts.pollMs ? setInterval(load, opts.pollMs) : undefined;
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path, opts.pollMs, tick]);

  if (state.status === "cooking" && opts.sample !== undefined) {
    return { status: "ok", data: opts.sample, reload, isSample: true };
  }
  return { ...state, reload, isSample: false };
}

/** POST/DELETE helper for buttons. Never throws: returns what happened. */
export async function send<T = unknown>(
  path: string,
  init: { method?: "POST" | "DELETE"; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(path, {
      method: init.method ?? "POST",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err instanceof Error ? err.message : String(err) } as T & { error?: string } };
  }
}
