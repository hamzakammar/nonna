/**
 * The demo clock. ALWAYS use `now()` from here instead of `new Date()` / `Date.now()`.
 *
 * Why: the demo has to show "milk expires tomorrow", "Saturday rush" and
 * "a week of sales" in 3 minutes. The demo panel (/demo) moves this clock forward,
 * and every lane has to agree on what time it is.
 */
import { bus } from "./events";

const g = globalThis as unknown as { __nonnaClockOffsetMs?: number };
g.__nonnaClockOffsetMs ??= 0;

export function now(): Date {
  return new Date(Date.now() + (g.__nonnaClockOffsetMs ?? 0));
}

export function nowIso(): string {
  return now().toISOString();
}

/** Jump the clock forward (or back) by `ms`. Used by /api/sim. */
export function advance(ms: number): Date {
  g.__nonnaClockOffsetMs = (g.__nonnaClockOffsetMs ?? 0) + ms;
  const t = now();
  bus.emit("clock.changed", { now: t.toISOString() });
  return t;
}

/** Set the clock to an absolute time. */
export function setNow(target: Date): Date {
  g.__nonnaClockOffsetMs = target.getTime() - Date.now();
  bus.emit("clock.changed", { now: target.toISOString() });
  return target;
}

export function reset(): void {
  g.__nonnaClockOffsetMs = 0;
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
