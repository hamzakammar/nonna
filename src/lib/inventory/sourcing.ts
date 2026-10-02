/**
 * Who we buy each ingredient from. Each ingredient can have several supplier
 * offers. The policy:
 *   1. find the cheapest offer
 *   2. if a LOCAL supplier is within 10% of it, buy local ("Local legend" on the wishlist)
 * The pick is written back to ingredients.supplier_id / unit_cost_cents, so
 * everyone else (reorders, Lane 3's margins) uses the current price without knowing about offers.
 */
import type { PriceChange, SourcingReason, Supplier, SupplierOffer } from "@/lib/types";
import { bus } from "@/lib/events";
import { db, tx } from "@/lib/db";
import { now, DAY } from "@/lib/clock";
import { getIngredient, getSupplier, toSupplier } from "./rows";

const LOCAL_PREMIUM = 0.1;

export interface SourcingChoice {
  supplierId: string;
  supplierName: string;
  unitCostCents: number;
  reason: SourcingReason;
  /** Plain words for Nonna and the dashboard, e.g. "Maple Hill Creamery (local, 7% more than Gerald's Dairy)". */
  note: string;
}

export function listOffers(ingredientId: string): (SupplierOffer & { supplier: Supplier })[] {
  return db()
    .prepare("SELECT o.unit_cost_cents AS offer_cost, s.* FROM supplier_offers o JOIN suppliers s ON s.id = o.supplier_id WHERE o.ingredient_id = ? ORDER BY o.unit_cost_cents")
    .all(ingredientId)
    .map((r) => ({ ingredientId, supplierId: String(r.id), unitCostCents: Number(r.offer_cost), supplier: toSupplier(r) }));
}

const pctMore = (cost: number, base: number) => Math.round(((cost - base) / base) * 100);

export function chooseSupplier(ingredientId: string): SourcingChoice {
  const offers = listOffers(ingredientId);
  if (offers.length === 0) throw new Error(`No supplier offers for ${ingredientId}`);
  const cheapest = offers[0]; // sorted by cost
  const pick = (o: (typeof offers)[number], reason: SourcingReason, note: string): SourcingChoice => ({
    supplierId: o.supplierId, supplierName: o.supplier.name, unitCostCents: o.unitCostCents, reason, note,
  });

  if (offers.length === 1) return pick(cheapest, "only_option", cheapest.supplier.name);
  if (cheapest.supplier.isLocal) return pick(cheapest, "cheapest", `${cheapest.supplier.name} (local, cheapest)`);

  const local = offers.find((o) => o.supplier.isLocal && o.unitCostCents <= cheapest.unitCostCents * (1 + LOCAL_PREMIUM));
  if (local) {
    const pct = pctMore(local.unitCostCents, cheapest.unitCostCents);
    return pick(local, "local_within_10pct", `${local.supplier.name} (local, ${pct}% more than ${cheapest.supplier.name})`);
  }
  const runnerUp = offers[1];
  return pick(cheapest, "cheapest", `${cheapest.supplier.name} (cheapest, ${pctMore(runnerUp.unitCostCents, cheapest.unitCostCents)}% under ${runnerUp.supplier.name})`);
}

/** Re-run the policy and store the pick as the ingredient's current supplier + cost. */
export function refreshSourcing(ingredientId: string): SourcingChoice {
  const choice = chooseSupplier(ingredientId);
  db().prepare("UPDATE ingredients SET supplier_id = ?, unit_cost_cents = ? WHERE id = ?").run(choice.supplierId, choice.unitCostCents, ingredientId);
  return choice;
}

export function refreshAllSourcing(): void {
  tx(() => {
    for (const r of db().prepare("SELECT id FROM ingredients").all()) refreshSourcing(String(r.id));
  });
}

/** Ingredient cost of one unit of every product that uses `ingredientId`, at a given price for that ingredient. */
function productCosts(ingredientId: string, unitCostForIngredient: number) {
  const rows = db()
    .prepare(
      `SELECT p.id, p.name, p.price_cents, ri.ingredient_id, ri.qty_per_unit, i.unit_cost_cents
       FROM products p JOIN recipe_items ri ON ri.product_id = p.id JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE p.id IN (SELECT product_id FROM recipe_items WHERE ingredient_id = ?)`,
    )
    .all(ingredientId);
  const byProduct = new Map<string, { productId: string; name: string; priceCents: number; costCents: number }>();
  for (const r of rows) {
    const id = String(r.id);
    const entry = byProduct.get(id) ?? { productId: id, name: String(r.name), priceCents: Number(r.price_cents), costCents: 0 };
    const unitCost = r.ingredient_id === ingredientId ? unitCostForIngredient : Number(r.unit_cost_cents);
    entry.costCents += Number(r.qty_per_unit) * unitCost;
    byProduct.set(id, entry);
  }
  return [...byProduct.values()];
}

const marginPct = (price: number, cost: number) => Math.round(((price - cost) / price) * 1000) / 10;

/**
 * A supplier changes their price (the trade-war button). Updates the offer,
 * re-picks the supplier, works out the margin hit on every affected product, and
 * emits `price.changed`.
 */
export function setOfferPrice(supplierId: string, ingredientId: string, unitCostCents: number): PriceChange {
  if (!(unitCostCents > 0)) throw new Error(`Invalid price ${unitCostCents}`);
  const ingredient = getIngredient(ingredientId);
  const supplier = getSupplier(supplierId);
  const offer = db().prepare("SELECT unit_cost_cents FROM supplier_offers WHERE ingredient_id = ? AND supplier_id = ?").get(ingredientId, supplierId) as
    | { unit_cost_cents: number }
    | undefined;
  if (!offer) throw new Error(`${supplier.name} doesn't sell ${ingredient.name}`);

  const before = { supplierId: ingredient.supplierId, supplierName: getSupplier(ingredient.supplierId).name, unitCostCents: ingredient.unitCostCents };
  const after = tx(() => {
    db().prepare("UPDATE supplier_offers SET unit_cost_cents = ? WHERE ingredient_id = ? AND supplier_id = ?").run(unitCostCents, ingredientId, supplierId);
    return refreshSourcing(ingredientId);
  });

  const oldCosts = new Map(productCosts(ingredientId, before.unitCostCents).map((p) => [p.productId, p.costCents]));
  const t = now();
  const unitsSold = db().prepare(
    "SELECT COALESCE(SUM(si.qty), 0) AS n FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.product_id = ? AND s.at > ? AND s.at <= ?",
  );
  const weekAgo = new Date(t.getTime() - 7 * DAY).toISOString();
  const products = productCosts(ingredientId, after.unitCostCents).map((p) => {
    const oldCost = oldCosts.get(p.productId) ?? p.costCents;
    const units = (unitsSold.get(p.productId, weekAgo, t.toISOString()) as { n: number }).n;
    return {
      productId: p.productId,
      name: p.name,
      priceCents: p.priceCents,
      oldCostCents: Math.round(oldCost),
      newCostCents: Math.round(p.costCents),
      oldMarginPct: marginPct(p.priceCents, oldCost),
      newMarginPct: marginPct(p.priceCents, p.costCents),
      unitsLast7Days: units,
      weeklyImpactCents: Math.round(units * (p.costCents - oldCost)),
    };
  });
  const change: PriceChange = {
    ingredientId,
    ingredientName: ingredient.name,
    supplierId,
    supplierName: supplier.name,
    oldUnitCostCents: offer.unit_cost_cents,
    newUnitCostCents: unitCostCents,
    pctChange: pctMore(unitCostCents, offer.unit_cost_cents),
    before,
    after: { supplierId: after.supplierId, supplierName: after.supplierName, unitCostCents: after.unitCostCents, reason: after.reason },
    products,
    weeklyImpactCents: products.reduce((sum, p) => sum + p.weeklyImpactCents, 0),
  };
  bus.emit("price.changed", { change });
  return change;
}

/** Every supplier with what they sell and at what price (dashboard + "compare suppliers"). */
export function listSuppliers(): (Supplier & { offers: { ingredientId: string; ingredientName: string; unitCostCents: number; isCurrent: boolean }[] })[] {
  const suppliers = db().prepare("SELECT * FROM suppliers ORDER BY name").all().map(toSupplier);
  const offers = db()
    .prepare("SELECT o.*, i.name AS ingredient_name, i.supplier_id AS current_supplier FROM supplier_offers o JOIN ingredients i ON i.id = o.ingredient_id ORDER BY i.name")
    .all();
  return suppliers.map((s) => ({
    ...s,
    offers: offers
      .filter((o) => o.supplier_id === s.id)
      .map((o) => ({
        ingredientId: String(o.ingredient_id),
        ingredientName: String(o.ingredient_name),
        unitCostCents: Number(o.unit_cost_cents),
        isCurrent: o.current_supplier === s.id,
      })),
  }));
}
