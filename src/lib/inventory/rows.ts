/** Lane 1 internals: DB row → shared type mappers and small queries. Not for other lanes. */
import type { Ingredient, Reorder, StockLot, Supplier, Unit, WasteEvent } from "@/lib/types";
import { db } from "@/lib/db";

type R = Record<string, unknown>;

export const toIngredient = (r: R): Ingredient => ({
  id: String(r.id),
  name: String(r.name),
  unit: r.unit as Unit,
  reorderPoint: Number(r.reorder_point),
  reorderQty: Number(r.reorder_qty),
  unitCostCents: Number(r.unit_cost_cents),
  shelfLifeDays: Number(r.shelf_life_days),
  supplierId: String(r.supplier_id),
});

export const toSupplier = (r: R): Supplier => ({
  id: String(r.id),
  name: String(r.name),
  contact: String(r.contact),
  leadTimeHours: Number(r.lead_time_hours),
  isLocal: Number(r.is_local) === 1,
  rampCardId: r.ramp_card_id ? String(r.ramp_card_id) : undefined,
});

export const toLot = (r: R): StockLot => ({
  id: String(r.id),
  ingredientId: String(r.ingredient_id),
  qtyRemaining: Number(r.qty_remaining),
  receivedAt: String(r.received_at),
  expiresAt: String(r.expires_at),
});

export const toReorder = (r: R): Reorder => ({
  id: String(r.id),
  ingredientId: String(r.ingredient_id),
  supplierId: String(r.supplier_id),
  qty: Number(r.qty),
  costCents: Number(r.cost_cents),
  reason: r.reason as Reorder["reason"],
  status: r.status as Reorder["status"],
  createdAt: String(r.created_at),
  placedAt: r.placed_at ? String(r.placed_at) : undefined,
  receivedAt: r.received_at ? String(r.received_at) : undefined,
  rampTransactionId: r.ramp_transaction_id ? String(r.ramp_transaction_id) : undefined,
});

export const toWaste = (r: R): WasteEvent => ({
  id: String(r.id),
  lotId: String(r.lot_id),
  ingredientId: String(r.ingredient_id),
  qty: Number(r.qty),
  costCents: Number(r.cost_cents),
  reason: r.reason as WasteEvent["reason"],
  at: String(r.at),
});

export function getIngredient(id: string): Ingredient {
  const row = db().prepare("SELECT * FROM ingredients WHERE id = ?").get(id);
  if (!row) throw new Error(`Unknown ingredient ${id}`);
  return toIngredient(row);
}

export function getSupplier(id: string): Supplier {
  const row = db().prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
  if (!row) throw new Error(`Unknown supplier ${id}`);
  return toSupplier(row);
}

export function getReorder(id: string): Reorder {
  const row = db().prepare("SELECT * FROM reorders WHERE id = ?").get(id);
  if (!row) throw new Error(`Unknown reorder ${id}`);
  return toReorder(row);
}

/** Usable stock: lots with qty left that haven't expired yet (expired lots are waste, even before scanExpiry runs). */
export function usableQty(ingredientId: string, nowIso: string): number {
  const row = db()
    .prepare("SELECT COALESCE(SUM(qty_remaining), 0) AS q FROM stock_lots WHERE ingredient_id = ? AND qty_remaining > 0 AND expires_at > ?")
    .get(ingredientId, nowIso) as { q: number };
  return round(row.q);
}

/** Usable lots, oldest expiry first (FIFO order). */
export function usableLots(ingredientId: string, nowIso: string): StockLot[] {
  return db()
    .prepare("SELECT * FROM stock_lots WHERE ingredient_id = ? AND qty_remaining > 0 AND expires_at > ? ORDER BY expires_at ASC")
    .all(ingredientId, nowIso)
    .map(toLot);
}

export function openReorderFor(ingredientId: string): Reorder | undefined {
  const row = db()
    .prepare("SELECT * FROM reorders WHERE ingredient_id = ? AND status IN ('proposed','placed') ORDER BY created_at DESC LIMIT 1")
    .get(ingredientId);
  return row ? toReorder(row) : undefined;
}

/** Quantities are REAL. Round to 2 decimals so 0.1 + 0.2 style noise never trips a threshold. */
export const round = (n: number) => Math.round(n * 100) / 100;
