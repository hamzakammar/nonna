/**
 * Wires the lanes together once per server process. Every API route calls
 * `ensureBooted()` first. Each lane adds its listener registration below and
 * touches nothing else in this file.
 */
import { registerInventoryListeners } from "./inventory";
import { registerAnalyticsListeners } from "./analytics";
import { registerPrepListeners } from "./sales/prep";
import { registerNotifyListeners } from "./notify";
import { registerPriceWatchListeners } from "./pricewatch/refresh";
import { db } from "./db";
import { seed } from "./db/seed";
import { simulateHistory } from "./sales/simulate";

const g = globalThis as unknown as { __nonnaBooted?: boolean };

export function ensureBooted(): void {
  if (g.__nonnaBooted) return;
  g.__nonnaBooted = true;
  // A brand-new database (fresh clone, or a new Vercel instance whose /tmp is empty) gets the
  // demo world: catalogue, stock, and 21 days of sales, the same as "Reset world". Off with NONNA_AUTOSEED=0.
  if (process.env.NONNA_AUTOSEED !== "0" && !db().prepare("SELECT 1 FROM products LIMIT 1").get()) {
    seed();
    simulateHistory({ days: 21, seed: 42 });
  }
  registerInventoryListeners(); // Lane 1
  registerAnalyticsListeners(); // Lane 3
  registerPrepListeners(); // Lane 3
  registerNotifyListeners(); // Lane 2
  registerPriceWatchListeners(); // Lane 1 (after notify, so the first refresh's events are heard)
}
