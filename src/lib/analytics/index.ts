/**
 * LANE 3: THE LEDGER. Analytics, busyness and the Gentle Truth.
 * Spec: docs/roles/lane-3-ledger.md
 *
 * Rule: this module computes the numbers. The voice lane may reword the
 * output but never changes a number. Every function here is deterministic
 * given the DB and clock.now().
 */
import type { BusynessBucket, GentleTruth, PrepSuggestion, ProductPerformance, RushStatus } from "@/lib/types";
import { todo } from "@/lib/todo";

/** Rank products by units, revenue and margin over the last `days`. Trend compares to the previous window. */
export function productPerformance(days = 7): ProductPerformance[] {
  void days;
  return todo("lane3 productPerformance");
}

/** Day-of-week × hour heatmap from sales cadence, blended with camera people counts if any exist. */
export function busynessHeatmap(days = 28): BusynessBucket[] {
  void days;
  return todo("lane3 busynessHeatmap");
}

/** How busy it is right now (last 30 min vs the usual for this slot) and when the next rush is expected. */
export function rushStatus(): RushStatus {
  return todo("lane3 rushStatus");
}

/** How many of each product to make for `dateIso` (default: tomorrow). Basis: same weekday, recent weeks, minus waste. */
export function prepForecast(dateIso?: string): PrepSuggestion[] {
  void dateIso;
  return todo("lane3 prepForecast");
}

/** One kind, specific, actionable note per "struggling" product (and a compliment for the "star"). */
export function gentleTruths(days = 14): GentleTruth[] {
  void days;
  return todo("lane3 gentleTruths");
}

/** Money lost to expired stock, by ingredient, over the last `days`. */
export function wasteSummary(days = 7): { ingredientId: string; name: string; costCents: number }[] {
  void days;
  return todo("lane3 wasteSummary");
}

/**
 * Called once at boot. Suggested wiring:
 *  - "sale.recorded" → recompute rushStatus; emit "rush.changed" when the label changes
 *  - "clock.changed" → when the demo clock crosses closing time (18:00), emit "insight.ready"
 */
export function registerAnalyticsListeners(): void {
  // TODO(lane3)
}
