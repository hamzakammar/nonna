/**
 * Part of npm run check:pantry. Covers Lane 1's stretch features on a fresh throwaway DB:
 * local-first sourcing, the trade-war price shock, usage forecast, and the maxed-card flow.
 */
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

process.env.NONNA_DB_PATH = path.join(os.tmpdir(), `nonna-check-stretch-${process.pid}.db`);

async function main() {
  const { seed } = await import("../src/lib/db/seed");
  const { bus } = await import("../src/lib/events");
  const { now, DAY, HOUR } = await import("../src/lib/clock");
  const { db } = await import("../src/lib/db");
  const inv = await import("../src/lib/inventory");
  const { suggestQty } = await import("../src/lib/inventory/forecast");
  const { payments, CardDeclinedError } = await import("../src/lib/ramp-mock");
  type EventMap = import("../src/lib/types").EventMap;

  seed();
  const got: { [K in keyof EventMap]?: EventMap[K][] } = {};
  const record = <K extends keyof EventMap>(e: K) => bus.on(e, (p) => void (got[e] ??= [] as never[]).push(p as never));
  record("price.changed"); record("card.declined"); record("reorder.proposed");
  const ok = (msg: string) => console.log(`  ✓ ${msg}`);
  const current = (ingId: string) => inv.listInventory().find((s) => s.ingredient.id === ingId)!.ingredient;

  console.log("local-first sourcing");
  assert.equal(current("ing_milk").supplierId, "sup_maple");
  assert.equal(current("ing_apples").supplierId, "sup_rosa");
  assert.equal(current("ing_eggs").supplierId, "sup_rosa");
  ok("milk → Maple Hill, apples + eggs → Rosa: local wins when ≤10% pricier");
  assert.equal(current("ing_butter").supplierId, "sup_bulk");
  assert.equal(current("ing_cream").supplierId, "sup_gerald");
  assert.match(inv.chooseSupplier("ing_cream").note, /Gerald's Dairy \(cheapest, 21% under Maple Hill Creamery\)/);
  ok("butter → BulkMart, cream → Gerald: cheapest wins when local is >10% pricier");

  console.log("trade war");
  const change = inv.setOfferPrice("sup_gerald", "ing_cream", 0.95);
  assert.equal(change.pctChange, 36);
  assert.equal(change.before.supplierId, "sup_gerald"); assert.equal(change.after.supplierId, "sup_maple");
  assert.equal(current("ing_cream").unitCostCents, 0.85);
  const parfait = change.products.find((p) => p.productId === "prd_fall_parfait")!;
  // 30ml cream per parfait × (0.85 − 0.70)¢ = 4.5¢ more per parfait (costs are rounded to whole cents)
  assert.ok([4, 5].includes(parfait.newCostCents - parfait.oldCostCents), `delta ${parfait.newCostCents - parfait.oldCostCents}`);
  assert.ok(parfait.newMarginPct < parfait.oldMarginPct);
  assert.deepEqual(change.products.map((p) => p.productId).sort(), ["prd_fall_parfait", "prd_tiramisu"]);
  assert.equal(got["price.changed"]?.length, 1);
  ok(`Gerald +36% on cream → switch to Maple Hill; Fall Parfait margin ${parfait.oldMarginPct}% → ${parfait.newMarginPct}%`);
  const creamRo = inv.proposeReorder("ing_cream", "manual");
  assert.equal(creamRo.supplierId, "sup_maple"); assert.equal(creamRo.costCents, 3400);
  assert.match(creamRo.note ?? "", /Maple Hill/);
  inv.cancelReorder(creamRo.id);
  ok("next cream order goes to Maple Hill ($34) with a note explaining why");
  inv.setOfferPrice("sup_rosa", "ing_apples", 0.41);
  assert.equal(current("ing_apples").supplierId, "sup_rosa");
  inv.setOfferPrice("sup_rosa", "ing_apples", 0.43);
  assert.equal(current("ing_apples").supplierId, "sup_bulk");
  ok("Rosa apples +8% vs BulkMart: stay local; +13%: switch to BulkMart");

  console.log("usage forecast");
  // 7 days of history: 30 Fall Parfaits a day.
  const insSale = db().prepare("INSERT INTO sales (id, at, total_cents, payment_method, source) VALUES (?,?,?,?,?)");
  const insItem = db().prepare("INSERT INTO sale_items (sale_id, product_id, qty, unit_price_cents) VALUES (?,?,?,?)");
  for (let d = 1; d <= 7; d++) {
    const id = `sale_hist_${d}`;
    insSale.run(id, new Date(now().getTime() - d * DAY + HOUR).toISOString(), 30 * 750, "card", "simulator");
    insItem.run(id, "prd_fall_parfait", 30, 750);
  }
  const pumpkin = inv.listInventory().find((s) => s.ingredient.id === "ing_pumpkin")!;
  // 30 parfaits × 60g = 1800g/day, over a history span of 7 days minus 1h
  assert.ok(Math.abs(pumpkin.dailyUsage! - (1800 * 7) / (7 - 1 / 24)) < 1, `pumpkin usage ${pumpkin.dailyUsage}`);
  assert.ok(pumpkin.daysOfCover! < 2 && pumpkin.runsOutAt);
  ok(`pumpkin: ~${Math.round(pumpkin.dailyUsage!)}g/day, ${pumpkin.daysOfCover} days of cover`);
  const proposed = inv.scanForecast();
  const pumpkinRo = proposed.find((r) => r.ingredientId === "ing_pumpkin")!;
  assert.ok(pumpkinRo, "pumpkin will run out before Dave can deliver → forecast reorder");
  assert.equal(pumpkinRo.reason, "forecast"); assert.equal(pumpkinRo.status, "proposed");
  assert.match(pumpkinRo.note ?? "", /days of cover/);
  assert.ok(pumpkinRo.qty > 3000 && pumpkinRo.qty <= 9000, `sized to usage, got ${pumpkinRo.qty}`);
  ok(`runs out before delivery → asks to order ${pumpkinRo.qty}g early (${pumpkinRo.note})`);
  assert.ok(!proposed.some((r) => r.ingredientId === "ing_flour"), "unused ingredients aren't forecast");
  const hike = inv.setOfferPrice("sup_maple", "ing_cream", 1.0); // Maple Hill raises too: 0.85 → 1.00, still cheapest
  const hikeParfait = hike.products.find((p) => p.productId === "prd_fall_parfait")!;
  assert.equal(hikeParfait.unitsLast7Days, 210);
  assert.equal(hikeParfait.weeklyImpactCents, Math.round(210 * 30 * 0.15));
  ok(`price change with history: Fall Parfait +$${(hikeParfait.weeklyImpactCents / 100).toFixed(2)}/week at last week's 210 sold`);
  inv.cancelReorder(pumpkinRo.id);
  assert.ok(!inv.scanForecast().some((r) => r.ingredientId === "ing_pumpkin"));
  ok("Grandma says no → not asked again for 24h");
  const berries = current("ing_berries");
  const spoilSafe = suggestQty(berries, 0, 300);
  assert.equal(spoilSafe.qty, 300 * berries.shelfLifeDays); assert.match(spoilSafe.note!, /spoils/);
  ok(`berries at 300g/day: order ${spoilSafe.qty}g, not ${berries.reorderQty}g (would spoil first)`);
  assert.equal(suggestQty(berries, 0, undefined).qty, berries.reorderQty);
  ok("no history → falls back to reorderQty");

  console.log("maxed card");
  payments.setSpendLimit("card_dave", 2000);
  const big = inv.proposeReorder("ing_pumpkin", "manual", 6000);
  assert.throws(() => inv.approveReorder(big.id), CardDeclinedError);
  const declined = got["card.declined"]!.at(-1)!;
  assert.equal(declined.reason, "over_limit"); assert.equal(declined.suggestedLimitCents, 5000);
  ok("$30 order on a $20 card → card.declined, Nonna suggests $50");
  assert.throws(() => inv.raiseCardLimit("card_dave", 1_000_000));
  const raised = inv.raiseCardLimit("card_dave", declined.suggestedLimitCents!, big.id);
  assert.equal(raised.spendLimitCents, 5000); assert.equal(raised.reorder?.status, "placed");
  ok("'yes, raise it' → limit $50 and the order goes through; absurd raises refused");

  console.log("\nAll pantry stretch checks passed ✅");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const s of ["", "-wal", "-shm"]) rmSync(process.env.NONNA_DB_PATH! + s, { force: true });
    process.exit();
  });
