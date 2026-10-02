/**
 * LANE 1: PRICE WATCH. What the competition charges, and what to do about it.
 *
 * Competitor prices arrive AUTOMATICALLY via ./refresh.ts: nearby bakeries are
 * found (OpenStreetMap / Google Places free tier / mock), and their OWN websites'
 * menus are read daily. Changes only. Fallbacks: a menu photo read by Claude
 * (./vision.ts) or voice/manual entry. Google Maps / Uber Eats pages are never
 * scraped (against their terms).
 *
 * The advice is deterministic code: our ingredient cost (from today's supplier
 * prices) sets a margin floor, and we never suggest going below it. Nonna only
 * rewords `reason`; she never invents a price.
 */
import type { Competitor, CompetitorPrice, PriceAction, PriceAdvice, Product } from "@/lib/types";
import { bus } from "@/lib/events";
import { db, id, tx } from "@/lib/db";
import { nowIso } from "@/lib/clock";

/** Lowest margin we'll ever suggest (0.6 = ingredients may be at most 40% of the price). */
const minMargin = () => Number(process.env.PRICEWATCH_MIN_MARGIN ?? 0.6);
const UNDERCUT_CENTS = 25;
const RAISE_GAP_CENTS = 50;

type R = Record<string, unknown>;

const toPrice = (r: R): CompetitorPrice => ({
  id: String(r.id),
  competitorId: String(r.competitor_id),
  itemName: String(r.item_name),
  priceCents: Number(r.price_cents),
  productId: r.product_id ? String(r.product_id) : undefined,
  observedAt: String(r.observed_at),
  source: r.source as CompetitorPrice["source"],
});

const toProduct = (r: R): Product => ({
  id: String(r.id),
  name: String(r.name),
  emoji: String(r.emoji),
  priceCents: Number(r.price_cents),
  category: r.category as Product["category"],
  active: Number(r.active) === 1,
});

export const toCompetitor = (r: R): Competitor => ({
  id: String(r.id),
  name: String(r.name),
  source: (r.source as Competitor["source"]) ?? "manual",
  externalId: r.external_id ? String(r.external_id) : undefined,
  website: r.website ? String(r.website) : undefined,
  lastCheckedAt: r.last_checked_at ? String(r.last_checked_at) : undefined,
  lastStatus: r.last_status ? (r.last_status as Competitor["lastStatus"]) : undefined,
});

export function listCompetitors(): Competitor[] {
  return db().prepare("SELECT * FROM competitors ORDER BY name").all().map(toCompetitor);
}

/** Manual fallback ("Nonna, The Bakery's parfait is $7.25"). Discovery normally adds competitors itself. */
export function addCompetitor(name: string): Competitor {
  const existing = db().prepare("SELECT * FROM competitors WHERE lower(name) = lower(?)").get(name.trim());
  if (existing) return toCompetitor(existing);
  const c = { id: id("comp"), name: name.trim(), source: "manual" };
  db().prepare("INSERT INTO competitors (id, name, source) VALUES (?, ?, ?)").run(c.id, c.name, c.source);
  return toCompetitor(c);
}

/** The most recent observation of each item on each competitor's menu. */
export function latestPrices(competitorId?: string): CompetitorPrice[] {
  const rows = db()
    .prepare(
      `SELECT cp.* FROM competitor_prices cp
       WHERE cp.observed_at = (SELECT MAX(observed_at) FROM competitor_prices x
                               WHERE x.competitor_id = cp.competitor_id AND lower(x.item_name) = lower(cp.item_name))
       ${competitorId ? "AND cp.competitor_id = ?" : ""}
       ORDER BY cp.competitor_id, cp.item_name`,
    )
    .all(...(competitorId ? [competitorId] : []));
  return rows.map(toPrice);
}

// ---------- Matching their menu items to our products ----------

const SYNONYMS: Record<string, string[]> = {
  fall: ["pumpkin", "autumn", "spice", "harvest"],
  pie: ["slice", "crumble", "tart"],
  berry: ["berries", "strawberry", "blueberry", "mixed"],
  loaf: ["bread", "cake"],
};
const STOPWORDS = new Set(["the", "a", "of", "and", "with", "slice", "cup", "fresh", "classic", "house"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);
/** Distinctive words of OUR product name: "Apple Pie (slice)" → [apple, pie]. Their names keep every word. */
const productTokens = (s: string) => words(s.replace(/\([^)]*\)/g, " ")).filter((t) => !STOPWORDS.has(t));

/**
 * Deterministic best match for voice/manual entries: every distinctive word of
 * our product name (or a synonym) must appear in their item name. Photos use
 * Claude's matching instead (vision.ts), which handles fancier menu names.
 */
export function matchProduct(itemName: string): string | undefined {
  const theirs = new Set(words(itemName));
  const has = (t: string) => theirs.has(t) || (SYNONYMS[t] ?? []).some((s) => theirs.has(s));
  let best: { id: string; matched: number } | undefined;
  for (const p of db().prepare("SELECT id, name FROM products WHERE active = 1").all()) {
    const ours = productTokens(String(p.name));
    if (ours.length === 0 || !ours.every(has)) continue;
    // Prefer the product whose name explains more of their item ("Pumpkin Loaf" beats "Loaf").
    if (!best || ours.length > best.matched) best = { id: String(p.id), matched: ours.length };
  }
  return best?.id;
}

// ---------- Recording prices ----------

export interface IncomingPrice {
  itemName: string;
  priceCents: number;
  productId?: string | null; // null = definitely no match; undefined = let matchProduct decide
}

/**
 * Save new competitor prices and emit `competitor.prices` with the actionable
 * advice (undercut / raise) for the products they touch.
 */
export function recordPrices(competitorId: string, items: IncomingPrice[], source: CompetitorPrice["source"]): { prices: CompetitorPrice[]; advice: PriceAdvice[] } {
  if (!db().prepare("SELECT 1 FROM competitors WHERE id = ?").get(competitorId)) throw new Error(`Unknown competitor ${competitorId}`);
  const productIds = new Set(db().prepare("SELECT id FROM products").all().map((r) => String(r.id)));
  const at = nowIso();
  const prices = tx(() =>
    items.map((item) => {
      if (!item.itemName?.trim()) throw new Error("Item name is required");
      if (!Number.isInteger(item.priceCents) || item.priceCents <= 0) throw new Error(`Invalid price for ${item.itemName}`);
      let productId = item.productId === undefined ? matchProduct(item.itemName) : item.productId ?? undefined;
      if (productId && !productIds.has(productId)) productId = undefined;
      const p: CompetitorPrice = { id: id("cp"), competitorId, itemName: item.itemName.trim(), priceCents: item.priceCents, productId, observedAt: at, source };
      db()
        .prepare("INSERT INTO competitor_prices (id, competitor_id, item_name, price_cents, product_id, observed_at, source) VALUES (?,?,?,?,?,?,?)")
        .run(p.id, p.competitorId, p.itemName, p.priceCents, p.productId ?? null, p.observedAt, p.source);
      return p;
    }),
  );
  const touched = new Set(prices.map((p) => p.productId).filter(Boolean));
  const advice = priceAdvice().filter((a) => touched.has(a.productId) && (a.action === "undercut" || a.action === "raise"));
  bus.emit("competitor.prices", { competitorId, prices, advice });
  return { prices, advice };
}

// ---------- Advice ----------

/** Ingredient cost of one unit, at today's supplier prices (cents, unrounded). */
export function unitCostCents(productId: string): number {
  const row = db()
    .prepare("SELECT COALESCE(SUM(ri.qty_per_unit * i.unit_cost_cents), 0) AS c FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.product_id = ?")
    .get(productId) as { c: number };
  return row.c;
}

const marginPct = (price: number, cost: number) => Math.round(((price - cost) / price) * 1000) / 10;
const down5 = (c: number) => Math.floor(c / 5) * 5;
const up5 = (c: number) => Math.ceil(c / 5) * 5;
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Lowest price that keeps the margin floor, rounded up to 5¢. */
export function floorPriceCents(productId: string): number {
  return up5(unitCostCents(productId) / (1 - minMargin()));
}

/**
 * Pricing advice for every product a competitor also sells. If several competitors
 * sell it, we compare against the cheapest one.
 */
export function priceAdvice(): PriceAdvice[] {
  const competitors = new Map(listCompetitors().map((c) => [c.id, c.name]));
  const cheapestByProduct = new Map<string, CompetitorPrice>();
  for (const p of latestPrices()) {
    if (!p.productId) continue;
    const cur = cheapestByProduct.get(p.productId);
    if (!cur || p.priceCents < cur.priceCents) cheapestByProduct.set(p.productId, p);
  }

  const advice: PriceAdvice[] = [];
  for (const row of db().prepare("SELECT * FROM products WHERE active = 1 ORDER BY name").all()) {
    const product = toProduct(row);
    const theirs = cheapestByProduct.get(product.id);
    if (!theirs) continue;

    const cost = unitCostCents(product.id);
    const floor = floorPriceCents(product.id);
    const ours = product.priceCents;
    const competitorName = competitors.get(theirs.competitorId) ?? theirs.competitorId;
    const floorPct = Math.round(minMargin() * 100);

    let action: PriceAction;
    let suggested: number | undefined;
    if (ours >= theirs.priceCents) {
      const target = down5(theirs.priceCents - UNDERCUT_CENTS);
      if (target >= floor) {
        action = "undercut";
        suggested = target;
      } else {
        action = "cant_undercut";
      }
    } else if (theirs.priceCents - ours >= RAISE_GAP_CENTS) {
      action = "raise";
      suggested = down5(theirs.priceCents - UNDERCUT_CENTS);
    } else {
      action = "hold";
    }

    const facts = `${competitorName}'s ${theirs.itemName}: ${$(theirs.priceCents)}. Our ${product.name}: ${$(ours)} (costs ${$(Math.round(cost))} to make, ${marginPct(ours, cost)}% margin).`;
    const why: Record<PriceAction, string> = {
      undercut: `Drop to ${$(suggested ?? 0)} to beat them by ${$(theirs.priceCents - (suggested ?? 0))}: still ${marginPct(suggested ?? 1, cost)}% margin.`,
      raise: `We're ${$(theirs.priceCents - ours)} cheaper. Raise to ${$(suggested ?? 0)} and still beat them.`,
      hold: `We're already ${$(theirs.priceCents - ours)} cheaper. Leave it.`,
      cant_undercut: `Beating them would mean under ${$(floor)}, below our ${floorPct}% margin floor. Hold, and win on quality.`,
    };

    advice.push({
      productId: product.id,
      name: product.name,
      competitorId: theirs.competitorId,
      competitorName,
      theirItemName: theirs.itemName,
      theirPriceCents: theirs.priceCents,
      ourPriceCents: ours,
      unitCostCents: Math.round(cost),
      marginPctNow: marginPct(ours, cost),
      floorPriceCents: floor,
      action,
      suggestedPriceCents: suggested,
      marginPctAtSuggested: suggested ? marginPct(suggested, cost) : undefined,
      reason: `${facts} ${why[action]}`,
    });
  }
  return advice;
}

/**
 * Change one of our menu prices (Grandma said yes). Refuses to go below the
 * margin floor unless `allowBelowFloor`, so Nonna can't talk her into losing money.
 */
export function setPrice(productId: string, priceCents: number, opts: { allowBelowFloor?: boolean } = {}): Product & { marginPct: number } {
  const row = db().prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!row) throw new Error(`Unknown product ${productId}`);
  if (!Number.isInteger(priceCents) || priceCents <= 0) throw new Error(`Invalid price ${priceCents}`);
  const floor = floorPriceCents(productId);
  if (priceCents < floor && !opts.allowBelowFloor) {
    throw new Error(`${$(priceCents)} is below the margin floor (${$(floor)}) for ${String(row.name)}`);
  }
  db().prepare("UPDATE products SET price_cents = ? WHERE id = ?").run(priceCents, productId);
  const product = toProduct({ ...row, price_cents: priceCents });
  return { ...product, marginPct: marginPct(priceCents, unitCostCents(productId)) };
}
