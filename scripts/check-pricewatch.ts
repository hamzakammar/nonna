/** Part of npm run check:pantry: Price Watch (competitor prices + pricing advice) on a throwaway DB. */
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

process.env.NONNA_DB_PATH = path.join(os.tmpdir(), `nonna-check-pw-${process.pid}.db`);

async function main() {
  const { seed } = await import("../src/lib/db/seed");
  const { bus } = await import("../src/lib/events");
  const pw = await import("../src/lib/pricewatch");
  const inv = await import("../src/lib/inventory");
  const { readMenuPhoto, MenuReaderUnavailableError } = await import("../src/lib/pricewatch/vision");
  type EventMap = import("../src/lib/types").EventMap;

  seed();
  const events: EventMap["competitor.prices"][] = [];
  bus.on("competitor.prices", (e) => void events.push(e));
  const ok = (msg: string) => console.log(`  ✓ ${msg}`);
  const adviceFor = (id: string) => pw.priceAdvice().find((a) => a.productId === id);

  console.log("advice vs The Bakery (seeded mock feed)");
  const fall = adviceFor("prd_fall_parfait")!;
  assert.equal(fall.unitCostCents, 204); assert.equal(fall.floorPriceCents, 510);
  assert.equal(fall.action, "undercut"); assert.equal(fall.suggestedPriceCents, 700); assert.equal(fall.marginPctAtSuggested, 70.9);
  ok(`Fall Parfait: theirs $7.25, ours $7.50 → undercut to $7.00 (70.9% margin)`);
  const berry = adviceFor("prd_berry_parfait")!;
  assert.equal(berry.action, "cant_undercut"); assert.equal(berry.floorPriceCents, 685); assert.equal(berry.suggestedPriceCents, undefined);
  ok("Berry Parfait: $6.25 would break the 60% floor ($6.85) → can't undercut");
  const croissant = adviceFor("prd_croissant")!;
  assert.equal(croissant.action, "raise"); assert.equal(croissant.suggestedPriceCents, 425);
  ok("Croissant: 75¢ under them → raise to $4.25, still cheaper");
  assert.equal(adviceFor("prd_apple_pie")!.action, "undercut"); assert.equal(adviceFor("prd_apple_pie")!.suggestedPriceCents, 500);
  assert.equal(adviceFor("prd_latte")!.action, "hold");
  assert.equal(adviceFor("prd_espresso"), undefined, "Double Espresso was seeded as no-match");
  assert.equal(adviceFor("prd_tiramisu"), undefined);
  ok("apple pie → undercut $5.00, latte → hold, unmatched items ignored");
  assert.match(fall.reason, /The Bakery's Pumpkin Spice Parfait: \$7\.25\. Our Fall Parfait: \$7\.50/);
  ok("reason is factual text with exact numbers");

  console.log("matching menu names to our products");
  const cases: [string, string | undefined][] = [
    ["Pumpkin Spice Parfait", "prd_fall_parfait"], ["Blueberry Parfait", "prd_berry_parfait"],
    ["Dutch Apple Slice", "prd_apple_pie"], ["Iced Oat Latte", "prd_latte"], ["Pumpkin Bread", "prd_pumpkin_loaf"],
    ["Croissant aux amandes", "prd_croissant"], ["Lemon Tart", undefined], ["Sourdough Loaf", undefined],
  ];
  for (const [name, want] of cases) assert.equal(pw.matchProduct(name), want, name);
  ok(`${cases.length} menu names matched (including "no match")`);

  console.log("recording new prices (voice/manual)");
  const { prices, advice } = pw.recordPrices("comp_bakery", [{ itemName: "Pumpkin Spice Parfait", priceCents: 695 }, { itemName: "Sourdough Loaf", priceCents: 900 }], "voice");
  assert.equal(prices[0].productId, "prd_fall_parfait"); assert.equal(prices[1].productId, undefined);
  assert.equal(adviceFor("prd_fall_parfait")!.theirPriceCents, 695, "latest observation wins");
  assert.equal(advice[0].suggestedPriceCents, 670);
  assert.equal(events.length, 1); assert.equal(events[0].advice.length, 1);
  ok("The Bakery drops to $6.95 → new advice $6.70, competitor.prices event with only actionable items");
  const rival = pw.addCompetitor("Crumb & Co");
  pw.recordPrices(rival.id, [{ itemName: "Fall Harvest Parfait", priceCents: 650 }], "manual");
  assert.equal(adviceFor("prd_fall_parfait")!.competitorName, "Crumb & Co");
  ok("two competitors → compare against the cheapest one");
  assert.throws(() => pw.recordPrices("comp_bakery", [{ itemName: "X", priceCents: 0 }], "manual"));
  ok("invalid prices rejected");

  console.log("applying a price");
  assert.throws(() => pw.setPrice("prd_berry_parfait", 625), /below the margin floor/);
  const applied = pw.setPrice("prd_fall_parfait", 625);
  assert.equal(applied.priceCents, 625); assert.equal(applied.marginPct, 67.4);
  assert.equal(adviceFor("prd_fall_parfait")!.action, "hold");
  ok("below-floor price refused; $6.25 parfait applied (67.4% margin) → now 'hold' vs Crumb & Co's $6.50");

  console.log("trade war moves the floor");
  const floorBefore = pw.floorPriceCents("prd_fall_parfait");
  inv.setOfferPrice("sup_gerald", "ing_cream", 0.95); // → Maple Hill at 0.85
  assert.equal(pw.floorPriceCents("prd_fall_parfait"), Math.ceil((204 + 30 * 0.15) / 0.4 / 5) * 5);
  assert.ok(pw.floorPriceCents("prd_fall_parfait") > floorBefore);
  ok(`cream price hike raises the Fall Parfait floor $${floorBefore / 100} → $${pw.floorPriceCents("prd_fall_parfait") / 100}`);

  console.log("menu photo reader without valid credentials");
  const saved = process.env.ANTHROPIC_API_KEY;
  if (!saved) {
    await assert.rejects(readMenuPhoto({ base64: "", mediaType: "image/png" }), MenuReaderUnavailableError);
    ok("no credentials at all → MenuReaderUnavailableError before any request");
  }
  process.env.ANTHROPIC_API_KEY = "sk-ant-invalid-for-test";
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  try {
    await readMenuPhoto({ base64: tinyPng, mediaType: "image/png" });
    assert.fail("should not succeed with an invalid key");
  } catch (err) {
    if (err instanceof MenuReaderUnavailableError) ok("bad key → MenuReaderUnavailableError (route returns 503)");
    else if (err instanceof Error && /Connection|fetch failed|ENOTFOUND/i.test(err.message)) console.log("  - skipped (no network)");
    else throw err;
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved;
  }

  console.log("\nAll Price Watch checks passed ✅");
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
