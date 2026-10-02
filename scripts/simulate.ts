/**
 * LANE 3: npm run simulate -- --days 21 --seed 42
 * Writes realistic sales history straight into the DB (source: "simulator") so the
 * analytics have something to chew on. Requirements are in docs/roles/lane-3-ledger.md § Simulator:
 *   - opening hours 7:00–18:00, morning coffee peak, lunch peak, Saturday is the busiest day
 *   - Fall Parfait trending UP, Apple Pie trending DOWN (the Gentle Truth demo needs this)
 *   - deterministic: same --seed → same data
 * History sales do NOT consume inventory (otherwise the seeded stock would be gone).
 * Only live sales through recordSale() do.
 *
 * How it works: each product gets a number of units per day (base rate × weekday ×
 * trend, ±5%). Each unit lands in a 15-minute slot picked by that product's
 * time-of-day shape, then the units in a slot are bundled into customer baskets
 * of 1–3 items. Each basket is one sale. Daily totals are kept tight on purpose:
 * the trends are the story, and loose randomness would drown them.
 */
import { db, tx } from "../src/lib/db";
import { now, DAY } from "../src/lib/clock";
import type { PaymentMethod } from "../src/lib/types";

// ---------- CLI ----------

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? NaN : Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}
const DAYS = arg("days", 21);
const SEED = arg("seed", 42);

// ---------- Seeded randomness ----------

/** mulberry32: a tiny PRNG. Same seed → same sequence of numbers in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

/** Pick an index with probability proportional to its weight (`weights` sums to 1). */
function pickWeighted(weights: number[]): number {
  let r = rand();
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

// ---------- The shop's story ----------

const OPEN_HOUR = 7;
const CLOSE_HOUR = 18;
const SLOT_MINUTES = 15;

/** Busyness by weekday, 0 = Sunday. Saturday busiest, Monday quietest. */
const WEEKDAY = [1.2, 0.7, 0.85, 0.9, 0.95, 1.15, 1.5];

/** A bump in demand centred on `hour`, `width` hours wide. */
const bump = (hour: number, centre: number, width: number) => Math.exp(-(((hour - centre) / width) ** 2));
const coffeePeak = (h: number) => bump(h, 8.5, 0.8); // 7:30–9:30
const lunchPeak = (h: number) => bump(h, 12.5, 0.8); // 11:30–13:30
const afternoon = (h: number) => bump(h, 16.75, 0.6); // after-school treats, after the 15:00 lull

type Shape = (hour: number) => number;
const SHAPES: Record<string, Shape> = {
  drink: (h) => 0.15 + 3 * coffeePeak(h) + 0.8 * lunchPeak(h) + 0.3 * afternoon(h),
  pastry: (h) => 0.15 + 2 * coffeePeak(h) + 1.2 * lunchPeak(h) + 0.4 * afternoon(h),
  treat: (h) => 0.1 + 0.3 * coffeePeak(h) + 2 * lunchPeak(h) + 1 * afternoon(h),
};

/**
 * `daily`: units on an average weekday at the start of the history.
 * `weekly`: growth per week. 1.27 → ×1.6 over 3 weeks, 0.775 → ×0.6.
 * Growth compounds (like interest), so every week-over-week window shows the same
 * clear trend, not just the last one.
 */
const PLAN: Record<string, { daily: number; shape: string; weekly: number }> = {
  prd_croissant: { daily: 45, shape: "pastry", weekly: 1 },
  prd_latte: { daily: 34, shape: "drink", weekly: 1 },
  prd_espresso: { daily: 22, shape: "drink", weekly: 1 },
  prd_fall_parfait: { daily: 9, shape: "treat", weekly: 1.27 },
  prd_berry_parfait: { daily: 11, shape: "treat", weekly: 1 },
  prd_apple_pie: { daily: 17, shape: "treat", weekly: 0.775 },
  prd_tiramisu: { daily: 7, shape: "treat", weekly: 1 },
  prd_pumpkin_loaf: { daily: 12, shape: "pastry", weekly: 1 },
};

// ---------- Generate ----------

type ProductRow = { id: string; price_cents: number };
type SimSale = { at: string; items: { productId: string; qty: number; unitPriceCents: number }[] };

const products = db().prepare("SELECT id, price_cents FROM products WHERE active = 1").all() as unknown as ProductRow[];
const planned = products.filter((p) => PLAN[p.id]);
for (const p of products) if (!PLAN[p.id]) console.warn(`  (no sales plan for ${p.id}, skipping it)`);

/** Share of a day's demand that falls in each slot, per shape. Sums to 1. */
const slotsPerDay = ((CLOSE_HOUR - OPEN_HOUR) * 60) / SLOT_MINUTES;
const slotShare: Record<string, number[]> = {};
for (const [name, shape] of Object.entries(SHAPES)) {
  const raw = Array.from({ length: slotsPerDay }, (_, s) => shape(OPEN_HOUR + ((s + 0.5) * SLOT_MINUTES) / 60));
  const total = raw.reduce((a, b) => a + b, 0);
  slotShare[name] = raw.map((v) => v / total);
}

const end = now();
const sales: SimSale[] = [];

for (let d = DAYS; d >= 0; d--) {
  const day = new Date(end.getTime() - d * DAY);
  day.setHours(OPEN_HOUR, 0, 0, 0); // local time: the heatmap buckets by local hour
  const weeksFromStart = (DAYS - d) / 7;
  const dayMood = 0.95 + 0.1 * rand(); // weather, a busy street, …: ±5% per day

  const unitsBySlot: ProductRow[][] = Array.from({ length: slotsPerDay }, () => []);
  for (const p of planned) {
    const plan = PLAN[p.id];
    const wobble = 0.95 + 0.1 * rand();
    const count = Math.round(plan.daily * WEEKDAY[day.getDay()] * dayMood * plan.weekly ** weeksFromStart * wobble);
    for (let n = 0; n < count; n++) unitsBySlot[pickWeighted(slotShare[plan.shape])].push(p);
  }

  // Bundle each slot's units into baskets of 1–3, each one a sale at a random minute in the slot.
  unitsBySlot.forEach((units, s) => {
    const slotStart = day.getTime() + s * SLOT_MINUTES * 60_000;
    while (units.length) {
      const size = Math.min(units.length, 1 + Math.floor(rand() * 3));
      const basket = Array.from({ length: size }, () => units.splice(Math.floor(rand() * units.length), 1)[0]);
      const at = slotStart + Math.floor(rand() * SLOT_MINUTES * 60_000);
      if (at > end.getTime()) continue; // history ends at "now"
      const items = new Map<string, SimSale["items"][number]>();
      for (const p of basket) {
        const line = items.get(p.id) ?? { productId: p.id, qty: 0, unitPriceCents: p.price_cents };
        line.qty++;
        items.set(p.id, line);
      }
      sales.push({ at: new Date(at).toISOString(), items: [...items.values()] });
    }
  });
}
sales.sort((a, b) => a.at.localeCompare(b.at));

// ---------- Write ----------

// Straight into the DB, not through recordSale(): one transaction for thousands of rows,
// and no `sale.recorded` events, so the pantry never consumes stock for history.
tx(() => {
  db().exec("DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE source = 'simulator')");
  db().exec("DELETE FROM sales WHERE source = 'simulator'");
  const insertSale = db().prepare(
    "INSERT INTO sales (id, at, total_cents, payment_method, source) VALUES (?, ?, ?, ?, 'simulator')",
  );
  const insertItem = db().prepare(
    "INSERT INTO sale_items (sale_id, product_id, qty, unit_price_cents) VALUES (?, ?, ?, ?)",
  );
  sales.forEach((sale, n) => {
    const saleId = `sale_sim${String(n).padStart(5, "0")}`;
    const total = sale.items.reduce((sum, i) => sum + i.qty * i.unitPriceCents, 0);
    const method: PaymentMethod = rand() < 0.7 ? "card" : "cash";
    insertSale.run(saleId, sale.at, total, method);
    for (const i of sale.items) insertItem.run(saleId, i.productId, i.qty, i.unitPriceCents);
  });
});

const units = sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0);
console.log(`Simulated ${sales.length} sales (${units} items) over ${DAYS} days, seed ${SEED}.`);
