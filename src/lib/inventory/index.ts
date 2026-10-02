/**
 * LANE 1: THE PANTRY. Inventory, expiry and reordering.
 * Spec: docs/roles/lane-1-pantry.md
 *
 * Public API: the only functions other lanes may import from here.
 * Internals (row mappers, FIFO helpers) go in other files in this folder.
 */
import type { IngredientStatus, Reorder, ReorderReason, Sale, StockLevel, StockLot, WasteEvent } from "@/lib/types";
import { bus } from "@/lib/events";
import { db, id, tx } from "@/lib/db";
import { now, nowIso, DAY, HOUR } from "@/lib/clock";
import { payments } from "@/lib/ramp-mock";
import {
  getIngredient, getReorder, getSupplier, openReorderFor, round,
  toIngredient, toLot, toReorder, toWaste, usableLots, usableQty,
} from "./rows";

const EXPIRING_WINDOW_MS = 24 * HOUR;

function levelFor(total: number, reorderPoint: number): StockLevel {
  if (total <= 0) return "out";
  if (total <= reorderPoint) return "low";
  return "ok";
}

/** Every ingredient with its live stock level, next expiry and any open reorder. */
export function listInventory(): IngredientStatus[] {
  const t = nowIso();
  const soon = new Date(now().getTime() + EXPIRING_WINDOW_MS).toISOString();
  return db()
    .prepare("SELECT * FROM ingredients ORDER BY name")
    .all()
    .map((row) => {
      const ingredient = toIngredient(row);
      const lots = usableLots(ingredient.id, t);
      const totalQty = round(lots.reduce((s, l) => s + l.qtyRemaining, 0));
      return {
        ingredient,
        totalQty,
        level: levelFor(totalQty, ingredient.reorderPoint),
        nextExpiry: lots[0]?.expiresAt,
        expiringSoonQty: round(lots.filter((l) => l.expiresAt <= soon).reduce((s, l) => s + l.qtyRemaining, 0)),
        openReorderId: openReorderFor(ingredient.id)?.id,
      };
    });
}

/**
 * Take `qty` of an ingredient out of stock, oldest-expiring lot first.
 * Returns how much was actually taken (less than `qty` if we ran short).
 * Must be called inside a tx().
 */
function takeFifo(ingredientId: string, qty: number, t: string): { taken: number; perLot: { lot: StockLot; qty: number }[] } {
  let remaining = qty;
  const perLot: { lot: StockLot; qty: number }[] = [];
  const update = db().prepare("UPDATE stock_lots SET qty_remaining = ? WHERE id = ?");
  for (const lot of usableLots(ingredientId, t)) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qtyRemaining, remaining);
    update.run(round(lot.qtyRemaining - take), lot.id);
    perLot.push({ lot, qty: take });
    remaining = round(remaining - take);
  }
  return { taken: round(qty - Math.max(remaining, 0)), perLot };
}

/**
 * Emit `stock.low` when stock crosses the reorder point, and again when it hits 0.
 * Firing only on the crossing keeps Nonna from nagging on every sale (philosophy rule 4).
 */
function emitThresholdCrossings(changes: { ingredientId: string; before: number; after: number }[]) {
  for (const { ingredientId, before, after } of changes) {
    const { reorderPoint } = getIngredient(ingredientId);
    const crossedLow = before > reorderPoint && after <= reorderPoint;
    const ranOut = before > 0 && after <= 0;
    if (crossedLow || ranOut) bus.emit("stock.low", { ingredientId, totalQty: after });
  }
}

/**
 * Subtract a sale's ingredients from stock using the recipes, oldest lot first (FIFO).
 * Emits `stock.low` on crossing the reorder point (and again on running out).
 * Stock never goes negative: shortfalls are clamped at 0 with a console.warn.
 */
export function consumeForSale(sale: Sale): void {
  const t = nowIso();
  const recipe = db().prepare("SELECT ingredient_id, qty_per_unit FROM recipe_items WHERE product_id = ?");

  // Total need per ingredient across all line items.
  const need = new Map<string, number>();
  for (const item of sale.items) {
    for (const r of recipe.all(item.productId) as { ingredient_id: string; qty_per_unit: number }[]) {
      need.set(r.ingredient_id, (need.get(r.ingredient_id) ?? 0) + r.qty_per_unit * item.qty);
    }
  }

  const changes = tx(() =>
    [...need].map(([ingredientId, qty]) => {
      const before = usableQty(ingredientId, t);
      const { taken } = takeFifo(ingredientId, round(qty), t);
      if (taken < round(qty)) {
        console.warn(`[pantry] sale ${sale.id}: needed ${round(qty)} of ${ingredientId}, only had ${taken}`);
      }
      return { ingredientId, before, after: usableQty(ingredientId, t) };
    }),
  );
  emitThresholdCrossings(changes);
}

/**
 * Write off expired stock and warn about stock expiring within 24h (demo clock).
 *  - expiring → emit `stock.expiring` (once per lot)
 *  - expired → WasteEvent, zero the lot, emit `stock.expired`, propose a reorder if now low
 */
export function scanExpiry(): { expiring: StockLot[]; expired: WasteEvent[] } {
  const t = nowIso();
  const soon = new Date(now().getTime() + EXPIRING_WINDOW_MS).toISOString();
  const conn = db();

  const expiredRows = conn
    .prepare("SELECT l.*, i.unit_cost_cents FROM stock_lots l JOIN ingredients i ON i.id = l.ingredient_id WHERE l.qty_remaining > 0 AND l.expires_at <= ?")
    .all(t);

  const expired = tx(() =>
    expiredRows.map((row) => {
      const lot = toLot(row);
      const waste: WasteEvent = {
        id: id("waste"),
        lotId: lot.id,
        ingredientId: lot.ingredientId,
        qty: lot.qtyRemaining,
        costCents: Math.round(lot.qtyRemaining * Number(row.unit_cost_cents)),
        reason: "expired",
        at: lot.expiresAt,
      };
      conn
        .prepare("INSERT INTO waste_events (id, lot_id, ingredient_id, qty, cost_cents, reason, at) VALUES (?,?,?,?,?,?,?)")
        .run(waste.id, waste.lotId, waste.ingredientId, waste.qty, waste.costCents, waste.reason, waste.at);
      conn.prepare("UPDATE stock_lots SET qty_remaining = 0 WHERE id = ?").run(lot.id);
      return waste;
    }),
  );

  const expiring = tx(() => {
    const lots = conn
      .prepare("SELECT * FROM stock_lots WHERE qty_remaining > 0 AND expires_at > ? AND expires_at <= ? AND expiring_notified_at IS NULL")
      .all(t, soon)
      .map(toLot);
    const mark = conn.prepare("UPDATE stock_lots SET expiring_notified_at = ? WHERE id = ?");
    for (const lot of lots) mark.run(t, lot.id);
    return lots;
  });

  for (const waste of expired) bus.emit("stock.expired", { waste });
  for (const lot of expiring) {
    bus.emit("stock.expiring", { lotId: lot.id, ingredientId: lot.ingredientId, expiresAt: lot.expiresAt });
  }
  for (const ingredientId of new Set(expired.map((w) => w.ingredientId))) {
    if (usableQty(ingredientId, t) <= getIngredient(ingredientId).reorderPoint) proposeReorder(ingredientId, "expired");
  }
  return { expiring, expired };
}

/**
 * Create a "proposed" reorder. Idempotent: if one is already open
 * (proposed/placed) for this ingredient, returns that one instead.
 * Emits `reorder.proposed`, which makes Nonna ask "Should I order…?"
 */
export function proposeReorder(ingredientId: string, reason: ReorderReason, qty?: number): Reorder {
  const open = openReorderFor(ingredientId);
  if (open) return open;

  const ingredient = getIngredient(ingredientId);
  const orderQty = round(qty ?? ingredient.reorderQty);
  if (!(orderQty > 0)) throw new Error(`Invalid reorder qty ${qty}`);

  const reorder: Reorder = {
    id: id("ro"),
    ingredientId,
    supplierId: ingredient.supplierId,
    qty: orderQty,
    costCents: Math.round(orderQty * ingredient.unitCostCents),
    reason,
    status: "proposed",
    createdAt: nowIso(),
  };
  db()
    .prepare("INSERT INTO reorders (id, ingredient_id, supplier_id, qty, cost_cents, reason, status, created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(reorder.id, reorder.ingredientId, reorder.supplierId, reorder.qty, reorder.costCents, reorder.reason, reorder.status, reorder.createdAt);
  bus.emit("reorder.proposed", { reorder });
  return reorder;
}

/**
 * Nonna said yes: pay on the supplier's mock Ramp card, set status "placed", emit `reorder.placed`.
 * Idempotent for already-placed reorders. If the card declines, the reorder stays
 * "proposed" and the `CardDeclinedError` propagates, so the caller can tell Grandma why.
 */
export function approveReorder(reorderId: string): Reorder {
  const reorder = getReorder(reorderId);
  if (reorder.status === "placed") return reorder;
  if (reorder.status !== "proposed") throw new Error(`Reorder ${reorderId} is ${reorder.status}, can't approve`);

  const supplier = getSupplier(reorder.supplierId);
  if (!supplier.rampCardId) throw new Error(`${supplier.name} has no card to pay with`);
  const ingredient = getIngredient(reorder.ingredientId);

  const transaction = payments.charge({
    cardId: supplier.rampCardId,
    amountCents: reorder.costCents,
    merchantName: supplier.name,
    memo: `Reorder ${reorder.id}: ${reorder.qty}${ingredient.unit} ${ingredient.name}`,
  });

  const placedAt = nowIso();
  db()
    .prepare("UPDATE reorders SET status = 'placed', placed_at = ?, ramp_transaction_id = ? WHERE id = ?")
    .run(placedAt, transaction.id, reorder.id);
  const placed: Reorder = { ...reorder, status: "placed", placedAt, rampTransactionId: transaction.id };
  bus.emit("reorder.placed", { reorder: placed, transaction });
  return placed;
}

/** Cancel an open reorder. A placed one is refunded on its Ramp card. */
export function cancelReorder(reorderId: string): Reorder {
  const reorder = getReorder(reorderId);
  if (reorder.status === "cancelled") return reorder;
  if (reorder.status === "received") throw new Error(`Reorder ${reorderId} already arrived, can't cancel`);
  if (reorder.status === "placed" && reorder.rampTransactionId) {
    payments.refund(reorder.rampTransactionId, `Cancelled reorder ${reorder.id}`);
  }
  db().prepare("UPDATE reorders SET status = 'cancelled' WHERE id = ?").run(reorder.id);
  return { ...reorder, status: "cancelled" };
}

/**
 * Delivery arrived: create a StockLot (expiresAt = now + shelfLifeDays), set
 * status "received", emit `reorder.received`. Idempotent.
 */
export function receiveReorder(reorderId: string): StockLot {
  const reorder = getReorder(reorderId);
  const lotId = `lot_${reorder.id}`;
  if (reorder.status === "received") {
    return toLot(db().prepare("SELECT * FROM stock_lots WHERE id = ?").get(lotId) as Record<string, unknown>);
  }
  if (reorder.status !== "placed") throw new Error(`Reorder ${reorderId} is ${reorder.status}, can't receive`);

  const ingredient = getIngredient(reorder.ingredientId);
  const t = now();
  const lot: StockLot = {
    id: lotId,
    ingredientId: reorder.ingredientId,
    qtyRemaining: reorder.qty,
    receivedAt: t.toISOString(),
    expiresAt: new Date(t.getTime() + ingredient.shelfLifeDays * DAY).toISOString(),
  };
  tx(() => {
    db()
      .prepare("INSERT INTO stock_lots (id, ingredient_id, qty_remaining, received_at, expires_at) VALUES (?,?,?,?,?)")
      .run(lot.id, lot.ingredientId, lot.qtyRemaining, lot.receivedAt, lot.expiresAt);
    db().prepare("UPDATE reorders SET status = 'received', received_at = ? WHERE id = ?").run(lot.receivedAt, reorder.id);
  });
  bus.emit("reorder.received", { reorder: { ...reorder, status: "received", receivedAt: lot.receivedAt }, lot });
  return lot;
}

/** Receive every placed reorder whose supplier lead time has passed (demo clock). */
export function receiveDueDeliveries(): StockLot[] {
  const t = now().getTime();
  return db()
    .prepare("SELECT r.*, s.lead_time_hours FROM reorders r JOIN suppliers s ON s.id = r.supplier_id WHERE r.status = 'placed'")
    .all()
    .filter((row) => new Date(String(row.placed_at)).getTime() + Number(row.lead_time_hours) * HOUR <= t)
    .map((row) => receiveReorder(String(row.id)));
}

/** Voice "Nonna, order more flour": propose + approve in one go (Grandma already said yes). */
export function orderNow(ingredientId: string, qty?: number): Reorder {
  const open = openReorderFor(ingredientId);
  if (open) return open.status === "proposed" ? approveReorder(open.id) : open;
  return approveReorder(proposeReorder(ingredientId, "manual", qty).id);
}

/** Voice "Nonna, I dropped a tray of berries": take it out of stock FIFO and log the waste. */
export function logWaste(ingredientId: string, qty: number, reason: WasteEvent["reason"] = "dropped"): WasteEvent[] {
  if (!(qty > 0)) throw new Error(`Invalid waste qty ${qty}`);
  const t = nowIso();
  const ingredient = getIngredient(ingredientId);
  const before = usableQty(ingredientId, t);
  const events = tx(() =>
    takeFifo(ingredientId, round(qty), t).perLot.map(({ lot, qty: q }) => {
      const w: WasteEvent = {
        id: id("waste"), lotId: lot.id, ingredientId, qty: q,
        costCents: Math.round(q * ingredient.unitCostCents), reason, at: t,
      };
      db()
        .prepare("INSERT INTO waste_events (id, lot_id, ingredient_id, qty, cost_cents, reason, at) VALUES (?,?,?,?,?,?,?)")
        .run(w.id, w.lotId, w.ingredientId, w.qty, w.costCents, w.reason, w.at);
      return w;
    }),
  );
  emitThresholdCrossings([{ ingredientId, before, after: usableQty(ingredientId, t) }]);
  return events;
}

export function listReorders(status?: Reorder["status"]): Reorder[] {
  const rows = status
    ? db().prepare("SELECT * FROM reorders WHERE status = ? ORDER BY created_at DESC").all(status)
    : db().prepare("SELECT * FROM reorders ORDER BY created_at DESC").all();
  return rows.map(toReorder);
}

export function listWaste(sinceIso?: string): WasteEvent[] {
  return db()
    .prepare("SELECT * FROM waste_events WHERE at > ? ORDER BY at DESC")
    .all(sinceIso ?? "")
    .map(toWaste);
}

/** Run the time-based checks: expiry + deliveries. Safe to call often. */
export function tick(): void {
  receiveDueDeliveries();
  scanExpiry();
}

/**
 * Called once at boot:
 *  - "sale.recorded" → consumeForSale
 *  - "stock.low"     → proposeReorder(id, "low_stock")
 *  - "clock.changed" → tick (expiry + deliveries); also every minute of real time
 */
export function registerInventoryListeners(): void {
  bus.on("sale.recorded", ({ sale }) => consumeForSale(sale));
  bus.on("stock.low", ({ ingredientId }) => {
    proposeReorder(ingredientId, "low_stock");
  });
  bus.on("clock.changed", () => tick());
  setInterval(() => {
    try {
      tick();
    } catch (err) {
      console.error("[pantry] tick failed", err);
    }
  }, 60_000).unref();
  // Next turn, so the other lanes' listeners (registered after us in boot.ts) hear the first events.
  setTimeout(() => tick(), 0);
}
