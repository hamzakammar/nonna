/**
 * Wires the lanes together once per server process. Every API route calls
 * `ensureBooted()` first. Each lane adds its listener registration below and
 * touches nothing else in this file.
 */
import { registerInventoryListeners } from "./inventory";
import { registerAnalyticsListeners } from "./analytics";
import { registerPrepListeners } from "./sales/prep";
import { registerNotifyListeners } from "./notify";

const g = globalThis as unknown as { __nonnaBooted?: boolean };

export function ensureBooted(): void {
  if (g.__nonnaBooted) return;
  g.__nonnaBooted = true;
  registerInventoryListeners(); // Lane 1
  registerAnalyticsListeners(); // Lane 3
  registerPrepListeners(); // Lane 3
  registerNotifyListeners(); // Lane 2
}
