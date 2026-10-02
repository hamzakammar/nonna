/**
 * Nonna's allowance: routine restocks are placed without asking. Anything
 * unusual still asks. See docs/DESIGN_PHILOSOPHY.md rule 5.
 *
 * Routine = all of:
 *   - triggered by the system (low_stock / expired), not a manual or forecast request
 *   - a normal-sized order (≤ 2× the ingredient's reorderQty; the forecast may size it up a bit)
 *   - costs ≤ AUTOPILOT_MAX_ORDER_CENTS
 *   - fits in what's left of AUTOPILOT_WEEKLY_BUDGET_CENTS (rolling 7 days, demo clock)
 *   - the supplier's card is ACTIVE and has room under its weekly limit (so autopilot never hits a decline)
 * The supplier card's own spend limit is still the hard ceiling (charge() enforces it).
 */
import type { Reorder } from "@/lib/types";
import { db } from "@/lib/db";
import { now, DAY } from "@/lib/clock";
import { payments } from "@/lib/ramp-mock";
import { getIngredient, getSupplier } from "./rows";

// Read on every call so the env (or a test) can change them without a restart.
const maxOrderCents = () => Number(process.env.AUTOPILOT_MAX_ORDER_CENTS ?? 2500);
const weeklyBudgetCents = () => Number(process.env.AUTOPILOT_WEEKLY_BUDGET_CENTS ?? 10000);

export interface AutopilotStatus {
  maxOrderCents: number;
  weeklyBudgetCents: number;
  spentCents: number; // auto-approved and not cancelled, last 7 days
  remainingCents: number;
}

export function autopilotStatus(): AutopilotStatus {
  const since = new Date(now().getTime() - 7 * DAY).toISOString();
  const { s } = db()
    .prepare("SELECT COALESCE(SUM(cost_cents), 0) AS s FROM reorders WHERE auto_approved = 1 AND status IN ('placed','received') AND placed_at > ?")
    .get(since) as { s: number };
  const budget = weeklyBudgetCents();
  return { maxOrderCents: maxOrderCents(), weeklyBudgetCents: budget, spentCents: s, remainingCents: Math.max(budget - s, 0) };
}

/** Is this freshly proposed reorder routine enough to place without asking? */
export function isRoutine(reorder: Reorder): boolean {
  if (reorder.reason !== "low_stock" && reorder.reason !== "expired") return false;
  const ingredient = getIngredient(reorder.ingredientId);
  if (reorder.qty > ingredient.reorderQty * 2) return false;
  if (reorder.costCents > maxOrderCents()) return false;
  if (reorder.costCents > autopilotStatus().remainingCents) return false;
  const cardId = getSupplier(reorder.supplierId).rampCardId;
  if (!cardId) return false;
  const card = payments.getCard(cardId);
  return card.state === "ACTIVE" && payments.weeklySpendCents(cardId) + reorder.costCents <= card.spendLimitCents;
}
