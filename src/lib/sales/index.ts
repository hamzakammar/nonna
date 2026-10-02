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
import type { RecordSaleInput, Sale } from "@/lib/types";
import { todo } from "@/lib/todo";

/** Validate, price from the products table, insert sale + sale_items in one tx, emit `sale.recorded`. */
export function recordSale(input: RecordSaleInput): Sale {
  void input;
  return todo("lane3 recordSale");
}

export function listSales(range: { sinceIso: string; untilIso?: string }): Sale[] {
  void range;
  return todo("lane3 listSales");
}
