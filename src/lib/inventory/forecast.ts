/**
 * How fast we use each ingredient, and how much to order.
 *
 * Usage comes from real sales history (sales → sale_items → recipes), so it
 * works with the simulator's history as well as live sales. With no history, every
 * function falls back to the ingredient's fixed reorderQty, so behaviour is the same as before.
 */
import type { Ingredient } from "@/lib/types";
import { db } from "@/lib/db";
import { now, DAY, HOUR } from "@/lib/clock";
import { getSupplier } from "./rows";

const USAGE_WINDOW_DAYS = 7;
/** Order enough to last the delivery time plus this many days. */
const COVER_DAYS = Number(process.env.PANTRY_COVER_DAYS ?? 5);

/** Average daily use per ingredient over the last 7 days (demo clock). Only ingredients with use are included. */
export function dailyUsageByIngredient(): Map<string, number> {
  const t = now();
  const since = new Date(t.getTime() - USAGE_WINDOW_DAYS * DAY).toISOString();
  const first = db().prepare("SELECT MIN(at) AS first FROM sales WHERE at > ? AND at <= ?").get(since, t.toISOString()) as { first: string | null };
  if (!first.first) return new Map();
  // Divide by the span we actually have history for, so 1 day of sales isn't spread over 7.
  const spanDays = Math.min(USAGE_WINDOW_DAYS, Math.max(1, (t.getTime() - new Date(first.first).getTime()) / DAY));
  const rows = db()
    .prepare(
      `SELECT ri.ingredient_id, SUM(si.qty * ri.qty_per_unit) AS used
       FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN recipe_items ri ON ri.product_id = si.product_id
       WHERE s.at > ? AND s.at <= ? GROUP BY ri.ingredient_id`,
    )
    .all(since, t.toISOString()) as { ingredient_id: string; used: number }[];
  return new Map(rows.filter((r) => r.used > 0).map((r) => [r.ingredient_id, r.used / spanDays]));
}

export function coverFor(totalQty: number, dailyUsage: number | undefined) {
  if (!dailyUsage) return {};
  const daysOfCover = Math.round((totalQty / dailyUsage) * 10) / 10;
  return {
    dailyUsage: Math.round(dailyUsage * 10) / 10,
    daysOfCover,
    runsOutAt: new Date(now().getTime() + daysOfCover * DAY).toISOString(),
  };
}

const roundUpQty = (qty: number, unit: Ingredient["unit"]) => (unit === "pcs" ? Math.ceil(qty) : Math.ceil(qty / 50) * 50);

/**
 * How much to order: enough for delivery time + COVER_DAYS at the current pace,
 * never less than reorderQty (supplier minimums), and never more than we'd use
 * before it spoils (waste guard). Capped at 3× reorderQty as a sanity limit.
 */
export function suggestQty(ingredient: Ingredient, totalQty: number, dailyUsage: number | undefined): { qty: number; note?: string } {
  if (!dailyUsage) return { qty: ingredient.reorderQty };
  const leadDays = getSupplier(ingredient.supplierId).leadTimeHours / 24;
  const need = dailyUsage * (leadDays + COVER_DAYS) - totalQty;
  const spoilCap = dailyUsage * ingredient.shelfLifeDays;

  let qty = Math.max(need, ingredient.reorderQty);
  let note = `~${COVER_DAYS} days of cover at ~${Math.round(dailyUsage)}${ingredient.unit}/day`;
  if (qty > spoilCap) {
    qty = Math.max(spoilCap, dailyUsage); // at least a day's worth
    note = `only what we'll use before it spoils (~${ingredient.shelfLifeDays} days at ~${Math.round(dailyUsage)}${ingredient.unit}/day)`;
  }
  qty = Math.min(qty, ingredient.reorderQty * 3);
  return { qty: roundUpQty(qty, ingredient.unit), note };
}

/**
 * Will this ingredient run out before a delivery could arrive (plus a day's buffer)?
 * Used by tick() to order early, with reason "forecast", before it's even "low".
 */
export function runsOutBeforeDelivery(ingredient: Ingredient, totalQty: number, dailyUsage: number | undefined): boolean {
  if (!dailyUsage || totalQty <= ingredient.reorderPoint) return false; // already handled by stock.low
  const leadMs = getSupplier(ingredient.supplierId).leadTimeHours * HOUR;
  return (totalQty / dailyUsage) * DAY < leadMs + DAY;
}
