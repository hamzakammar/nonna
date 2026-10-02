/**
 * LANE 1: THE PANTRY. Inventory, expiry and reordering.
 * Spec: docs/roles/lane-1-pantry.md
 *
 * Public API: the only functions other lanes may import from here.
 * Internals (row mappers, FIFO helpers) go in other files in this folder.
 */
import type { IngredientStatus, Reorder, ReorderReason, Sale, StockLot, WasteEvent } from "@/lib/types";
import { bus } from "@/lib/events";
import { todo } from "@/lib/todo";

/** Every ingredient with its live stock level, next expiry and any open reorder. */
export function listInventory(): IngredientStatus[] {
  return todo("lane1 listInventory");
}

/**
 * Subtract a sale's ingredients from stock using the recipes, oldest lot first (FIFO).
 * Emit `stock.low` when an ingredient crosses its reorder point. Emit it on the
 * crossing only, not on every sale after that.
 * Stock never goes negative. If it would, clamp at 0 and console.warn.
 */
export function consumeForSale(sale: Sale): void {
  void sale;
  todo("lane1 consumeForSale");
}

/**
 * Check lots against clock.now():
 *  - expiring within 24h → emit `stock.expiring` (once per lot)
 *  - expired → write a WasteEvent, zero the lot, emit `stock.expired`, then
 *    proposeReorder(..., "expired") if that drops stock below the reorder point
 */
export function scanExpiry(): { expiring: StockLot[]; expired: WasteEvent[] } {
  return todo("lane1 scanExpiry");
}

/**
 * Create a "proposed" reorder. Idempotent: if one is already open
 * (proposed/placed) for this ingredient, return that one instead.
 * Emits `reorder.proposed`, which makes Nonna ask "Should I order…?"
 */
export function proposeReorder(ingredientId: string, reason: ReorderReason, qty?: number): Reorder {
  void ingredientId; void reason; void qty;
  return todo("lane1 proposeReorder");
}

/** Nonna said yes: pay on the supplier's mock Ramp card, set status "placed", emit `reorder.placed`. */
export function approveReorder(reorderId: string): Reorder {
  void reorderId;
  return todo("lane1 approveReorder");
}

export function cancelReorder(reorderId: string): Reorder {
  void reorderId;
  return todo("lane1 cancelReorder");
}

/** Delivery arrived: create a StockLot (expiresAt = now + shelfLifeDays), set status "received", emit `reorder.received`. */
export function receiveReorder(reorderId: string): StockLot {
  void reorderId;
  return todo("lane1 receiveReorder");
}

export function listReorders(status?: Reorder["status"]): Reorder[] {
  void status;
  return todo("lane1 listReorders");
}

/**
 * Called once at boot. Subscribe to:
 *  - "sale.recorded"  → consumeForSale
 *  - "stock.low"      → proposeReorder(id, "low_stock")
 *  - "clock.changed"  → scanExpiry + auto-receive placed reorders whose lead time has passed
 */
export function registerInventoryListeners(): void {
  // TODO(lane1): replace these no-ops with the real wiring above.
  bus.on("sale.recorded", () => {});
}
