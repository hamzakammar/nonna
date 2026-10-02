/** Part of npm run check:pantry: automatic Price Watch (discovery → website menus → changes), fully offline. */
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

process.env.NONNA_DB_PATH = path.join(os.tmpdir(), `nonna-check-pwa-${process.pid}.db`);
process.env.PRICEWATCH_DISCOVERY = "mock";

async function main() {
  const { seed } = await import("../src/lib/db/seed");
  const { bus } = await import("../src/lib/events");
  const pw = await import("../src/lib/pricewatch");
  const { refreshCompetitors } = await import("../src/lib/pricewatch/refresh");
  const { robotsAllows, setMockVariant, FIXTURES_DIR } = await import("../src/lib/pricewatch/fetch");
  const { parseJsonLd, parseTextLines, menuLinks, siteNameOf, parseShopifyProducts, parseWooProducts, detectPlatform } = await import("../src/lib/pricewatch/menu");
  const { discover, apiUsage, FreeTierCapError, overpassQuery, shopLocation } = await import("../src/lib/pricewatch/discovery");
  type EventMap = import("../src/lib/types").EventMap;

  const ok = (msg: string) => console.log(`  ✓ ${msg}`);
  const fixture = (p: string) => readFileSync(path.join(FIXTURES_DIR, p), "utf8");

  console.log("parsers");
  assert.equal(robotsAllows("User-agent: *\nDisallow: /", "/menu"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /admin", "/menu"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nAllow: /menu", "/menu"), true);
  assert.equal(robotsAllows("User-agent: googlebot\nDisallow: /", "/menu"), true);
  assert.equal(robotsAllows("", "/"), true);
  ok("robots.txt: disallow, allow-overrides, other bots' rules, missing file");
  const ld = parseJsonLd(fixture("the-bakery/menu.html"));
  assert.equal(ld.length, 7);
  assert.deepEqual(ld.find((i) => i.itemName === "Butter Croissant"), { itemName: "Butter Croissant", priceCents: 450 });
  ok("JSON-LD: 7 items across nested menu sections, numeric and string prices");
  const text = parseTextLines(fixture("crumb-and-co/index.html"));
  assert.deepEqual(text.map((i) => `${i.itemName}=${i.priceCents}`), [
    "Fall Harvest Parfait=650", "Blueberry Parfait=675", "Almond Croissant=425", "Pumpkin Bread=395", "Drip Coffee=250",
  ]);
  ok("plain text: 5 'Item … $price' lines; phone number and hours ignored");
  assert.deepEqual(menuLinks(fixture("the-bakery/index.html"), "mock://the-bakery/"), ["mock://the-bakery/menu"]);
  assert.equal(siteNameOf(fixture("crumb-and-co/index.html")), "Crumb & Co.");
  ok("finds the 'Our Menu' link; site name from og:site_name / <title>");
  assert.equal(detectPlatform(fixture("loaf-and-ladle/index.html")), "shopify");
  assert.deepEqual(parseShopifyProducts(JSON.parse(fixture("loaf-and-ladle/products.json"))).find((i) => i.itemName === "Croissant"), { itemName: "Croissant", priceCents: 375 });
  // Shape recorded from a real WooCommerce Store API response (prices in minor units, HTML entities in names)
  assert.deepEqual(parseWooProducts([{ name: "Classic Japanese Cheesecake &#8211; Whole", prices: { price: "1599", currency_minor_unit: 2 } }]),
    [{ itemName: "Classic Japanese Cheesecake – Whole", priceCents: 1599 }]);
  ok("store catalogs: Shopify (first available variant), WooCommerce (minor units, entities decoded)");

  console.log("automatic refresh (mock discovery + mock websites)");
  seed();
  const priceEvents: EventMap["competitor.prices"][] = [];
  const discovered: string[] = [];
  bus.on("competitor.prices", (e) => void priceEvents.push(e));
  bus.on("competitor.discovered", (e) => void discovered.push(e.competitor.name));

  const run1 = await refreshCompetitors("mock");
  const by = (name: string) => run1.results.find((r) => r.name === name)!;
  assert.equal(by("The Bakery").method, "json-ld"); assert.equal(by("The Bakery").itemsFound, 7);
  assert.deepEqual(by("The Bakery").changed.map((c) => c.itemName), ["Maple Pecan Tart"], "only the item we didn't know");
  ok("The Bakery: menu page found, 7 items read, only the 1 new item recorded");
  assert.equal(by("Crumb & Co").method, "text"); assert.equal(by("Crumb & Co").changed.length, 5);
  assert.deepEqual(discovered.sort(), ["Crumb & Co", "Loaf & Ladle", "Rise & Shine Bakery", "Sugar Shack Patisserie"]);
  ok("Crumb & Co: discovered automatically, plain-text menu, 5 prices recorded");
  const loaf = by("Loaf & Ladle");
  assert.equal(loaf.method, "shopify"); assert.equal(loaf.itemsFound, 4, "gift card filtered out");
  assert.equal(loaf.changed.find((c) => c.itemName === "Apple Crumble Slice")?.productId, "prd_apple_pie");
  ok("Loaf & Ladle: Shopify store catalog read, gift card skipped, Apple Crumble Slice ↔ our Apple Pie");
  assert.equal(by("Sugar Shack Patisserie").status, "robots_blocked"); assert.equal(by("Sugar Shack Patisserie").itemsFound, 0);
  assert.equal(by("Rise & Shine Bakery").status, "no_website");
  ok("Sugar Shack: robots.txt says no → skipped; Rise & Shine: no website");
  const reviews = by("The Bakery").reviews!;
  assert.equal(reviews.reviewsRead, 5); assert.equal(reviews.saysPricey, 3); assert.equal(reviews.saysGoodValue, 1);
  assert.deepEqual(reviews.mentions.map((m) => m.priceCents), [725, 495]);
  ok("reviews: 3 of 5 call The Bakery pricey, $7.25 and $4.95 quoted (live, not stored)");
  const fall = pw.priceAdvice().find((a) => a.productId === "prd_fall_parfait")!;
  assert.equal(fall.competitorName, "Crumb & Co"); assert.equal(fall.theirPriceCents, 650); assert.equal(fall.suggestedPriceCents, 625);
  ok("advice now compares against the cheapest: Crumb & Co's $6.50 parfait → undercut to $6.25");
  const pie = pw.priceAdvice().find((a) => a.productId === "prd_apple_pie")!;
  assert.equal(pie.competitorName, "Loaf & Ladle"); assert.equal(pie.suggestedPriceCents, 470);
  ok("apple pie now vs Loaf & Ladle's $4.95 (cheaper than The Bakery) → undercut to $4.70");

  console.log("change detection");
  const eventsBefore = priceEvents.length;
  const run2 = await refreshCompetitors("mock");
  assert.ok(run2.results.filter((r) => r.itemsFound > 0).every((r) => r.status === "unchanged"));
  assert.equal(priceEvents.length, eventsBefore, "no news → Nonna stays quiet");
  ok("second run: nothing changed → no events, no new rows");
  setMockVariant("sale");
  const run3 = await refreshCompetitors("mock");
  setMockVariant(undefined);
  const sale = run3.results.find((r) => r.name === "The Bakery")!;
  assert.deepEqual(sale.changed.map((c) => `${c.itemName}=${c.priceCents}`), ["Pumpkin Spice Parfait=695"]);
  assert.equal(priceEvents.at(-1)!.prices[0].itemName, "Pumpkin Spice Parfait");
  ok("The Bakery puts the parfait on sale ($6.95) → exactly that change recorded + competitor.prices");

  console.log("Google Places provider (network stubbed)");
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  process.env.GOOGLE_PLACES_MONTHLY_CAP = "1";
  const realFetch = globalThis.fetch;
  let googleCalls = 0;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("places.googleapis.com")) {
      googleCalls++;
      assert.match(String((init?.headers as Record<string, string>)["X-Goog-FieldMask"]), /places\.websiteUri/);
      return new Response(JSON.stringify({ places: [{ id: "ChIJtest", displayName: { text: "GOOGLE DISPLAY NAME" }, websiteUri: "mock://crumb-and-co/", reviews: [{ text: { text: "So cheap!" } }] }] }));
    }
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    const g1 = await refreshCompetitors("google");
    assert.equal(googleCalls, 1); assert.equal(apiUsage().count, 1);
    const row = pw.listCompetitors().find((c) => c.externalId === "google:ChIJtest")!;
    assert.equal(row.name, "Crumb & Co.", "name comes from their own website, not Google");
    assert.equal(g1.results[0].reviews?.saysGoodValue, 1);
    ok("one Text Search call → place id stored, name taken from their own site, review signal live");
    await assert.rejects(discover("google"), FreeTierCapError);
    assert.equal(googleCalls, 1, "refused before calling Google");
    ok("monthly cap reached → refuses BEFORE calling Google (never bills)");
  } finally {
    globalThis.fetch = realFetch;
  }

  console.log("OpenStreetMap provider");
  const q = overpassQuery(shopLocation());
  assert.ok(q.includes('nw["shop"="bakery"](around:2000,43.4643,-80.5204)'), q);
  ok("Overpass query: bakeries/pastry shops within 2km of the shop (free, no key)");

  console.log("Petty Mode (parody)");
  const { roastCompetitor, postRoast, RoastRefusedError } = await import("../src/lib/pricewatch/roast");
  const roast = await roastCompetitor("comp_bakery", 3, 7);
  assert.equal(roast.drafts.length, 3); assert.equal(roast.parody, true);
  assert.ok(roast.drafts.every((d) => d.text.includes("The Bakery")));
  assert.deepEqual(await roastCompetitor("comp_bakery", 3, 7), roast, "same seed → same drafts");
  const spice2 = await roastCompetitor("comp_bakery", 2, 1);
  assert.ok(spice2.drafts.some((d) => /\$\d+\.\d{2}/.test(d.text)) || spice2.drafts.some((d) => d.text.includes("3 of 5")), "uses real numbers");
  ok(`3 spice-3 drafts about The Bakery, deterministic per seed: "${roast.drafts[0].text.slice(0, 60)}…"`);
  const real = pw.listCompetitors().find((c) => c.source === "google")!;
  await assert.rejects(roastCompetitor(real.id, 2), RoastRefusedError);
  ok("real (non-mock) businesses are refused");
  const veto = postRoast(3);
  assert.equal(veto.posted, false); assert.ok(veto.nonna.length > 10);
  ok(`'Post to Google' never posts: Nonna says "${veto.nonna}"`);

  console.log("\nAll automatic Price Watch checks passed ✅");
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
