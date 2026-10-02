/**
 * LANE 3: THE LEDGER. Sales intake.
 * Spec: docs/roles/lane-3-ledger.md
 *
 * Grandma's real Verifone terminal is standalone, so we can't read it.
 * Sales reach us from three places:
 *   1. the mock till at /pos (staff tap tiles)
 *   2. the simulator (`npm run simulate`), which generates realistic history
 *   3. voice ("Nonna, we just sold 3 croissants"), stretch goal
 * All three go through `recordSale`.
 */
import type { PaymentMethod, RecordSaleInput, Sale, SaleItem } from "@/lib/types";
import { db, id, tx } from "@/lib/db";
import { bus } from "@/lib/events";
import { nowIso } from "@/lib/clock";

type ProductRow = { price_cents: number; active: number };
type SaleRow = { id: string; at: string; total_cents: number; payment_method: PaymentMethod; source: Sale["source"] };
type SaleItemRow = { sale_id: string; product_id: string; qty: number; unit_price_cents: number };

const PAYMENT_METHODS: PaymentMethod[] = ["card", "cash"];

/** Validate, price from the products table, insert sale + sale_items in one tx, emit `sale.recorded`. */
export function recordSale(input: RecordSaleInput): Sale {
  if (!input.items?.length) throw new Error("A sale needs at least one item");
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new Error(`Unknown payment method "${input.paymentMethod}" (expected card or cash)`);
  }

  const findProduct = db().prepare("SELECT price_cents, active FROM products WHERE id = ?");
  const items: SaleItem[] = input.items.map(({ productId, qty }) => {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error(`Quantity for ${productId} must be a whole number above 0 (got ${qty})`);
    }
    const product = findProduct.get(productId) as ProductRow | undefined;
    if (!product) throw new Error(`Unknown product ${productId}`);
    if (!product.active) throw new Error(`${productId} is not on the menu right now`);
    return { productId, qty, unitPriceCents: product.price_cents };
  });

  const sale: Sale = {
    id: id("sale"),
    at: input.at ?? nowIso(),
    items,
    totalCents: items.reduce((sum, item) => sum + item.qty * item.unitPriceCents, 0),
    paymentMethod: input.paymentMethod,
    source: input.source ?? "pos",
  };

  tx(() => {
    db()
      .prepare("INSERT INTO sales (id, at, total_cents, payment_method, source) VALUES (?, ?, ?, ?, ?)")
      .run(sale.id, sale.at, sale.totalCents, sale.paymentMethod, sale.source);
    const insertItem = db().prepare(
      "INSERT INTO sale_items (sale_id, product_id, qty, unit_price_cents) VALUES (?, ?, ?, ?)",
    );
    for (const item of items) insertItem.run(sale.id, item.productId, item.qty, item.unitPriceCents);
  });

  // Only after COMMIT, so listeners never hear about a sale that was rolled back.
  bus.emit("sale.recorded", { sale });
  return sale;
}

/** Sales in [sinceIso, untilIso), oldest first. ISO strings in UTC sort the same as the times they hold. */
export function listSales(range: { sinceIso: string; untilIso?: string }): Sale[] {
  const until = range.untilIso ?? null;
  const sales = db()
    .prepare("SELECT * FROM sales WHERE at >= ? AND (? IS NULL OR at < ?) ORDER BY at")
    .all(range.sinceIso, until, until) as unknown as SaleRow[];
  const itemRows = db()
    .prepare(
      `SELECT si.* FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.at >= ? AND (? IS NULL OR s.at < ?)`,
    )
    .all(range.sinceIso, until, until) as unknown as SaleItemRow[];

  const itemsBySale = new Map<string, SaleItem[]>();
  for (const row of itemRows) {
    const list = itemsBySale.get(row.sale_id) ?? [];
    list.push({ productId: row.product_id, qty: row.qty, unitPriceCents: row.unit_price_cents });
    itemsBySale.set(row.sale_id, list);
  }

  return sales.map((row) => ({
    id: row.id,
    at: row.at,
    items: itemsBySale.get(row.id) ?? [],
    totalCents: row.total_cents,
    paymentMethod: row.payment_method,
    source: row.source,
  }));
}
