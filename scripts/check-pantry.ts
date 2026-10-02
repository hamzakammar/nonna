/**
 * npm run check:pantry: proves Lane 1's "Done when" criteria against a throwaway DB.
 * Doesn't need Lane 3: it builds Sale objects by hand and emits sale.recorded itself.
 */
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

process.env.NONNA_DB_PATH = path.join(os.tmpdir(), `nonna-check-${process.pid}.db`);

async function main() {
  const { seed } = await import("../src/lib/db/seed");
  const { bus } = await import("../src/lib/events");
  const { advance, DAY, HOUR } = await import("../src/lib/clock");
  const inv = await import("../src/lib/inventory");
  const { payments, CardDeclinedError } = await import("../src/lib/ramp-mock");
  const { db } = await import("../src/lib/db");
  type Sale = import("../src/lib/types").Sale;

  seed();
  inv.registerInventoryListeners();
  // The seed includes two weeks of past card charges, so assert spend relative to where each card started.
  const startSpend = Object.fromEntries(payments.listCards().map((c) => [c.id, payments.weeklySpendCents(c.id)]));
  const spentSinceStart = (cardId: string) => payments.weeklySpendCents(cardId) - startSpend[cardId];
  const startAllowance = inv.autopilotStatus().spentCents; // seeded past autopilot orders
  const events: string[] = [];
  for (const e of ["stock.low", "stock.expiring", "stock.expired", "reorder.proposed", "reorder.placed", "reorder.received"] as const) {
    bus.on(e, () => void events.push(e));
  }
  const count = (e: string) => events.filter((x) => x === e).length;
  const status = (ingId: string) => inv.listInventory().find((s) => s.ingredient.id === ingId)!;
  let n = 0;
  const sell = (productId: string, qty: number) => {
    const sale: Sale = { id: `sale_t${n++}`, at: new Date().toISOString(), items: [{ productId, qty, unitPriceCents: 0 }], totalCents: 0, paymentMethod: "card", source: "simulator" };
    bus.emit("sale.recorded", { sale });
  };
  const ok = (msg: string) => console.log(`  ✓ ${msg}`);

  console.log("listInventory");
  const cream = status("ing_cream");
  assert.equal(cream.totalQty, 1700); assert.equal(cream.level, "ok");
  assert.ok(status("ing_berries").expiringSoonQty > 0);
  ok("cream ok at 1700ml, berries expiring soon");

  console.log("consumeForSale");
  for (let i = 0; i < 7; i++) sell("prd_fall_parfait", 1);
  assert.equal(status("ing_cream").totalQty, 1490);
  assert.equal(count("stock.low"), 1, "stock.low fires once on crossing");
  ok("7 Fall Parfaits: cream 1700 → 1490, exactly one stock.low");
  sell("prd_fall_parfait", 1);
  assert.equal(count("stock.low"), 1);
  ok("further sales below the threshold don't re-fire");

  console.log("reorders");
  const ro = inv.listReorders("proposed").find((r) => r.ingredientId === "ing_cream")!;
  assert.ok(ro, "cream reorder proposed by the stock.low listener");
  assert.equal(ro.costCents, 2800); assert.equal(ro.autoApproved, false);
  assert.equal(count("reorder.proposed"), 1); assert.equal(count("reorder.placed"), 0);
  assert.equal(inv.proposeReorder("ing_cream", "manual").id, ro.id);
  ok(`cream $${ro.costCents / 100} is over the $25 allowance → proposed (Nonna asks), idempotent`);
  const placed = inv.approveReorder(ro.id);
  assert.equal(placed.status, "placed"); assert.ok(placed.rampTransactionId);
  assert.equal(spentSinceStart("card_gerald"), 2800);
  assert.equal(inv.approveReorder(ro.id).rampTransactionId, placed.rampTransactionId);
  ok("approve charges Gerald's card once ($28), idempotent");

  console.log("FIFO + running out");
  // Two butter lots: the seeded one expires in ~25 days, add one expiring sooner. FIFO must drain the sooner one first.
  db().prepare("INSERT INTO stock_lots (id, ingredient_id, qty_remaining, received_at, expires_at) VALUES ('lot_t_butter','ing_butter',100,?,?)")
    .run(new Date().toISOString(), new Date(Date.now() + 5 * DAY).toISOString());
  sell("prd_croissant", 2); // 70g butter
  const butterLot = (id: string) => (db().prepare("SELECT qty_remaining q FROM stock_lots WHERE id = ?").get(id) as { q: number }).q;
  assert.equal(butterLot("lot_t_butter"), 30); assert.equal(butterLot("lot_seed_4"), 5000);
  ok("FIFO drains the soonest-expiring lot first");
  sell("prd_apple_pie", 60); // 7200g apples needed, 7000g in stock
  assert.equal(status("ing_apples").totalQty, 0); assert.equal(status("ing_apples").level, "out");
  assert.equal(count("stock.low"), 2, "low + out in the same sale → one event (totalQty 0)");
  ok("overselling clamps at 0 and fires a single stock.low with totalQty 0");

  console.log("autopilot allowance");
  const apples = inv.listReorders().find((r) => r.ingredientId === "ing_apples")!;
  assert.equal(apples.status, "placed"); assert.equal(apples.autoApproved, true); assert.equal(apples.costCents, 2400);
  assert.equal(count("reorder.proposed"), 1, "routine reorder doesn't ask");
  assert.equal(spentSinceStart("card_rosa"), 2400);
  assert.equal(inv.autopilotStatus().spentCents - startAllowance, 2400);
  ok("apples ran out → routine $24 restock placed on autopilot, no question asked");
  const { notebookEntries } = await import("../src/lib/ramp-mock/notebook");
  const autoLine = notebookEntries().find((e) => e.autopilot)!;
  assert.equal(autoLine.line, "$24.00 for apples. I did this one myself, under my allowance. You're welcome.");
  ok(`notebook: "${autoLine.line}"`);
  process.env.AUTOPILOT_WEEKLY_BUDGET_CENTS = String(startAllowance + 3000); // $24 apples used, $6 left
  inv.logWaste("ing_pumpkin", 1600); // 2520g → 920g, below the 1000g reorder point
  const pumpkin = inv.listReorders().find((r) => r.ingredientId === "ing_pumpkin")!;
  assert.equal(pumpkin.status, "proposed"); assert.equal(pumpkin.costCents, 1500);
  ok("$15 pumpkin would exceed the weekly autopilot budget → asks instead");
  delete process.env.AUTOPILOT_WEEKLY_BUDGET_CENTS;
  inv.cancelReorder(apples.id);
  assert.equal(spentSinceStart("card_rosa"), 0); assert.equal(inv.autopilotStatus().spentCents - startAllowance, 0);
  ok("'cancel' undoes an autopilot order: refunded, budget restored");

  console.log("mock Ramp limits");
  payments.setCardState("card_bean", "SUSPENDED");
  assert.throws(() => inv.orderNow("ing_coffee"), CardDeclinedError);
  assert.equal(inv.listReorders("proposed").find((r) => r.ingredientId === "ing_coffee")?.status, "proposed");
  payments.setCardState("card_bean", "ACTIVE");
  assert.equal(inv.orderNow("ing_coffee").status, "placed");
  ok("suspended card declines and leaves the reorder proposed; reactivated → placed");
  assert.throws(() => payments.charge({ cardId: "card_dave", amountCents: 20001, merchantName: "x" }), CardDeclinedError);
  ok("over-limit charge declined");

  console.log("cancel + refund");
  const flour = inv.orderNow("ing_flour", 1000);
  inv.cancelReorder(flour.id);
  assert.equal(spentSinceStart("card_bulk"), 0);
  ok("cancelling a placed reorder refunds the card");

  console.log("expiry + deliveries (demo clock)");
  inv.scanExpiry();
  assert.ok(count("stock.expiring") >= 1);
  const expiringBefore = count("stock.expiring");
  inv.scanExpiry();
  assert.equal(count("stock.expiring"), expiringBefore, "stock.expiring fires once per lot");
  ok(`${expiringBefore} lot(s) flagged expiring, once each`);
  advance(DAY + 3 * HOUR); // clock.changed → tick
  assert.ok(count("stock.expired") >= 1);
  const berryWaste = inv.listWaste().filter((w) => w.ingredientId === "ing_berries");
  assert.equal(berryWaste.length, 1); assert.equal(berryWaste[0].costCents, Math.round(berryWaste[0].qty * 1.5));
  const berryRo = inv.listReorders().find((r) => r.ingredientId === "ing_berries")!;
  assert.equal(berryRo.reason, "expired"); assert.equal(berryRo.status, "proposed"); // $45 > allowance
  ok(`berries expired → $${berryWaste[0].costCents / 100} waste logged, $45 reorder proposed (over allowance, asks)`);
  assert.equal(inv.listReorders().find((r) => r.id === ro.id)?.status, "received");
  assert.equal(status("ing_cream").totalQty, 1460 + 4000);
  ok("cream delivery auto-received after Gerald's 12h lead time");

  console.log("logWaste");
  inv.logWaste("ing_yogurt", 500);
  assert.equal(status("ing_yogurt").totalQty, 6000 - 8 * 150 - 500);
  ok("dropped 500g yogurt → stock 4300g");

  console.log("\nAll pantry checks passed ✅");
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
