/**
 * LANE 3: THE LEDGER. Analytics, busyness and the Gentle Truth.
 * Spec: docs/roles/lane-3-ledger.md
 *
 * Rule: this module computes the numbers. The voice lane may reword the
 * output but never changes a number. Every function here is deterministic
 * given the DB and clock.now().
 */
import type { BusynessBucket, GentleTruth, PrepSuggestion, ProductPerformance, RushStatus, Trend } from "@/lib/types";
import { bus } from "@/lib/events";
import { db } from "@/lib/db";
import { now, DAY } from "@/lib/clock";

/** A change smaller than this (either way) counts as "steady". */
const TREND_THRESHOLD = 0.15;

const isoAgo = (ms: number) => new Date(now().getTime() - ms).toISOString();

/** Ingredient cost of one unit of each product, through its recipe. */
const UNIT_COST_SQL = `SELECT r.product_id, SUM(r.qty_per_unit * i.unit_cost_cents) AS unit_cost
  FROM recipe_items r JOIN ingredients i ON i.id = r.ingredient_id GROUP BY r.product_id`;

/** Level 0–4 for each value: 0 for nothing at all, otherwise its quartile among the non-zero values. */
function quantileLevels(values: number[]): BusynessBucket["level"][] {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  const cut = (q: number) => sorted[Math.floor(q * (sorted.length - 1))];
  const [q1, q2, q3] = [cut(0.25), cut(0.5), cut(0.75)];
  return values.map((v) => (v <= 0 ? 0 : v <= q1 ? 1 : v <= q2 ? 2 : v <= q3 ? 3 : 4));
}

function trendOf(current: number, previous: number): Trend {
  if (previous === 0) return current > 0 ? "rising" : "steady";
  const change = (current - previous) / previous;
  if (change >= TREND_THRESHOLD) return "rising";
  if (change <= -TREND_THRESHOLD) return "falling";
  return "steady";
}

type PerformanceRow = ProductPerformance & {
  /** Units sold in the previous window, scaled up if sales history doesn't reach back that far. */
  prevUnits: number;
  /** True when prevUnits is an estimate scaled up from less than a full window of history. */
  prevIsEstimate: boolean;
  /** (units − prevUnits) / prevUnits, or null when there is nothing to compare against. */
  change: number | null;
  unitCostCents: number;
  category: string;
};

/** productPerformance plus the working numbers the Gentle Truth and prep forecast need. */
function performanceRows(days: number): PerformanceRow[] {
  const since = isoAgo(days * DAY);
  const prevSince = isoAgo(2 * days * DAY);
  const rows = db()
    .prepare(
      `SELECT p.id, p.name, p.category,
         COALESCE(SUM(CASE WHEN s.at >= :since THEN si.qty END), 0)                      AS units,
         COALESCE(SUM(CASE WHEN s.at >= :since THEN si.qty * si.unit_price_cents END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN s.at <  :since THEN si.qty END), 0)                      AS prev_units,
         (SELECT COALESCE(SUM(r.qty_per_unit * i.unit_cost_cents), 0)
            FROM recipe_items r JOIN ingredients i ON i.id = r.ingredient_id
           WHERE r.product_id = p.id)                                                    AS unit_cost
       FROM products p
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON s.id = si.sale_id AND s.at >= :prevSince AND s.at < :until
       WHERE p.active = 1
       GROUP BY p.id`,
    )
    .all({ since, prevSince, until: isoAgo(0) }) as unknown as {
    id: string;
    name: string;
    category: string;
    units: number;
    revenue: number;
    prev_units: number;
    unit_cost: number;
  }[];

  // If history starts partway through the previous window (21 days of history, 14-day windows),
  // compare like with like: scale the previous window up to a full window's worth.
  const first = (db().prepare("SELECT MIN(at) AS at FROM sales").get() as { at: string | null }).at;
  const prevStartMs = Math.max(Date.parse(prevSince), first ? Date.parse(first) : Infinity);
  const prevCoveredMs = Date.parse(since) - prevStartMs;
  const scale = prevCoveredMs >= DAY ? (days * DAY) / prevCoveredMs : 0;

  // Best seller first. Ties go to whoever brought in more money.
  rows.sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  const quarter = Math.ceil(rows.length / 4);

  return rows.map((row, i): PerformanceRow => {
    const rank = i + 1;
    const prevUnits = Math.round(row.prev_units * scale);
    // Less than a day of earlier history: nothing fair to compare against, so call it steady.
    const trend = scale ? trendOf(row.units, prevUnits) : "steady";
    const verdict =
      rank <= quarter ? "star" : rank > rows.length - quarter && trend === "falling" ? "struggling" : "solid";
    return {
      productId: row.id,
      name: row.name,
      unitsSold: row.units,
      revenueCents: row.revenue,
      marginCents: Math.round(row.revenue - row.units * row.unit_cost),
      trend,
      rank,
      verdict,
      prevUnits,
      prevIsEstimate: scale > 1,
      change: scale && prevUnits ? (row.units - prevUnits) / prevUnits : null,
      unitCostCents: row.unit_cost,
      category: row.category,
    };
  });
}

/** Rank products by units, revenue and margin over the last `days`. Trend compares to the previous window. */
export function productPerformance(days = 7): ProductPerformance[] {
  return performanceRows(days).map((row) => ({
    productId: row.productId,
    name: row.name,
    unitsSold: row.unitsSold,
    revenueCents: row.revenueCents,
    marginCents: row.marginCents,
    trend: row.trend,
    rank: row.rank,
    verdict: row.verdict,
  }));
}

/** Day-of-week × hour heatmap from sales cadence, blended with camera people counts if any exist. */
export function busynessHeatmap(days = 28): BusynessBucket[] {
  const sales = db()
    .prepare(
      `WITH cost AS (${UNIT_COST_SQL})
       SELECT s.at, SUM(si.qty * (si.unit_price_cents - COALESCE(cost.unit_cost, 0))) AS margin
         FROM sales s
         JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN cost ON cost.product_id = si.product_id
        WHERE s.at >= ? AND s.at < ?
        GROUP BY s.id`,
    )
    .all(isoAgo(days * DAY), isoAgo(0)) as unknown as { at: string; margin: number }[];

  // How many Mondays, Tuesdays, … the window holds, to turn totals into averages.
  const weekdayCount = Array(7).fill(0);
  for (let d = 0; d < days; d++) weekdayCount[new Date(now().getTime() - d * DAY).getDay()]++;

  // Bucket by LOCAL weekday and hour: "Saturday at noon" means noon in the shop.
  const key = (dayOfWeek: number, hour: number) => dayOfWeek * 24 + hour;
  const totals = new Map<number, { sales: number; margin: number }>();
  const hours = new Set<number>([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]); // opening hours, even if empty
  for (const sale of sales) {
    const at = new Date(sale.at);
    hours.add(at.getHours());
    const t = totals.get(key(at.getDay(), at.getHours())) ?? { sales: 0, margin: 0 };
    t.sales++;
    t.margin += sale.margin;
    totals.set(key(at.getDay(), at.getHours()), t);
  }

  const buckets = [...hours]
    .sort((a, b) => a - b)
    .flatMap((hour) =>
      [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
        const t = totals.get(key(dayOfWeek, hour));
        const n = weekdayCount[dayOfWeek] || 1;
        return {
          dayOfWeek,
          hour,
          salesPerHour: Math.round(((t?.sales ?? 0) / n) * 10) / 10,
          marginPerHourCents: Math.round((t?.margin ?? 0) / n),
        };
      }),
    );
  const levels = quantileLevels(buckets.map((b) => b.salesPerHour));
  return buckets.map((b, i) => ({ ...b, level: levels[i] }));
}

const RUSH_WINDOW_MS = 30 * 60 * 1000;
const CLOSING_HOUR = 18;
const LABELS: RushStatus["label"][] = ["quiet", "quiet", "steady", "busy", "rush"];

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const hourName = (hour: number) => (hour === 12 ? "noon" : hour < 12 ? `${hour} am` : `${hour - 12} pm`);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** How busy it is right now (last 30 min vs the usual for this slot) and when the next rush is expected. */
export function rushStatus(): RushStatus {
  const t = now();
  const heatmap = busynessHeatmap();
  const recent = (
    db().prepare("SELECT COUNT(*) AS n FROM sales WHERE at >= ? AND at <= ?").get(isoAgo(RUSH_WINDOW_MS), t.toISOString()) as {
      n: number;
    }
  ).n;
  const ratePerHour = recent * (DAY / 24 / RUSH_WINDOW_MS);

  // Where does the live rate sit among all the usual hours of the week? Same cut points as the heatmap.
  const usual = heatmap.map((b) => b.salesPerHour);
  let level = quantileLevels([...usual, ratePerHour]).at(-1)!;

  // Then nudge by what's normal for THIS slot: twice the usual Tuesday 3 pm is notable even if small.
  const slot = heatmap.find((b) => b.dayOfWeek === t.getDay() && b.hour === t.getHours());
  if (slot && slot.salesPerHour > 0) {
    const vsUsual = ratePerHour / slot.salesPerHour;
    if (vsUsual >= 1.5 && level < 4) level++;
    if (vsUsual <= 0.5 && level > 0) level--;
  }

  // Next rush: the first level-4 hour after this one, within a week.
  let nextRushAt: string | undefined;
  for (let h = 1; h <= 24 * 7 && !nextRushAt; h++) {
    const at = new Date(t.getTime() + h * DAY / 24);
    at.setMinutes(0, 0, 0);
    if (heatmap.find((b) => b.dayOfWeek === at.getDay() && b.hour === at.getHours())?.level === 4) {
      nextRushAt = at.toISOString();
    }
  }

  return { now: level as RushStatus["now"], label: LABELS[level], nextRushAt };
}

/** Local "YYYY-MM-DD" → that day's [start, end) in the shop's time zone. */
function localDayBounds(day: string): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
}

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Morning batch on `day`, and units sold that day that came off the shelf. null = no batch that day. */
function freshBatch(productId: string, day: string, excludeSaleId: string): { made: number; offShelf: number } | null {
  const q = (sql: string, ...args: (string | number)[]) => (db().prepare(sql).get(...args) as { n: number | null }).n;
  const made = q("SELECT SUM(qty) AS n FROM prep_tasks WHERE day = ? AND product_id = ? AND kind = 'morning'", day, productId);
  if (made === null) return null;
  const { start, end } = localDayBounds(day);
  const sold =
    q(
      `SELECT COALESCE(SUM(si.qty), 0) AS n FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE si.product_id = ? AND s.at >= ? AND s.at < ? AND s.id != ?`,
      productId, start.toISOString(), end.toISOString(), excludeSaleId,
    ) ?? 0;
  // Units made for a specific customer go straight to them, never onto the shelf.
  const madeToOrder =
    q(
      "SELECT COALESCE(SUM(qty), 0) AS n FROM prep_tasks WHERE day = ? AND product_id = ? AND kind = 'order' AND sale_id IS NOT NULL",
      day, productId,
    ) ?? 0;
  return { made, offShelf: sold - madeToOrder };
}

/**
 * Yesterday's leftovers that carry into `day`: what was left of yesterday's morning batch.
 * Only one day back, because anything older is thrown out. 0 when yesterday had no batch.
 */
export function carriedInto(productId: string, day: string): number {
  const { start } = localDayBounds(day);
  start.setDate(start.getDate() - 1);
  const batch = freshBatch(productId, localDay(start), "");
  return batch ? Math.max(0, batch.made - batch.offShelf) : 0;
}

/**
 * Units of `productId` on the shelf on `day`, ignoring sale `excludeSaleId`:
 * the morning batch + yesterday's leftovers − units sold off the shelf.
 * null when there's no morning batch that day.
 */
export function shelfLeft(productId: string, day: string, excludeSaleId = ""): number | null {
  const batch = freshBatch(productId, day, excludeSaleId);
  if (!batch) return null;
  return Math.max(0, batch.made + carriedInto(productId, day) - batch.offShelf);
}

/**
 * How many of each product to make for `dateIso` (default: tomorrow). Basis: the same weekday
 * over the last 3 weeks, scaled by the product's current trend, minus the day before's leftovers
 * (from the make-list) once that day has closed. Drinks are made to order, so they're left out.
 */
export function prepForecast(dateIso?: string): PrepSuggestion[] {
  // "2026-10-03" on its own parses as UTC midnight, which is the evening before in the shop. Read it as local.
  const dateOnly = dateIso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const target = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : dateIso
      ? new Date(dateIso)
      : new Date(now().getTime() + DAY);
  target.setHours(0, 0, 0, 0);
  const first = (db().prepare("SELECT MIN(at) AS at FROM sales").get() as { at: string | null }).at;
  const countDay = db().prepare(
    `SELECT COALESCE(SUM(si.qty), 0) AS n FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id = ? AND s.at >= ? AND s.at < ?`,
  );

  // The same weekday, 1–3 weeks back, as long as history covers the whole day and it's over.
  const pastDays = [1, 2, 3]
    .map((w) => {
      const start = new Date(target);
      start.setDate(start.getDate() - 7 * w);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    })
    .filter(({ start, end }) => first && start.toISOString() >= first && end <= now())
    .reverse(); // oldest first, so the basis reads 12, 13, 16
  const weekday = WEEKDAYS[target.getDay()];

  // Yesterday's leftovers are only final once yesterday's shop has closed.
  const targetDay = localDay(target);
  const yesterdayClose = new Date(target);
  yesterdayClose.setDate(yesterdayClose.getDate() - 1);
  yesterdayClose.setHours(CLOSING_HOUR, 0, 0, 0);
  const leftoversKnown = yesterdayClose <= now();

  return performanceRows(7)
    .filter((row) => row.category !== "drink")
    .map((row): PrepSuggestion => {
      const counts = pastDays.map(
        ({ start, end }) => (countDay.get(row.productId, start.toISOString(), end.toISOString()) as { n: number }).n,
      );
      if (!counts.length) {
        return { productId: row.productId, name: row.name, suggestedQty: 0, basis: `no ${weekday} history yet` };
      }
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      // Trend from the last 7 days vs the 7 before, capped so one odd week can't double the batch.
      const factor = row.trend === "steady" || row.change === null ? 1 : Math.min(1.3, Math.max(0.7, 1 + row.change));
      const needed = Math.round(avg * factor);
      const leftover = leftoversKnown ? Math.min(needed, carriedInto(row.productId, targetDay)) : 0;
      const basis =
        `avg of the last ${counts.length} ${weekday}s: ${counts.join(", ")}` +
        (factor === 1 ? "" : `, ${factor > 1 ? "+" : ""}${Math.round((factor - 1) * 100)}% for this week's trend`) +
        (leftover ? `, minus ${leftover} left over from ${WEEKDAYS[(target.getDay() + 6) % 7]}` : "");
      return { productId: row.productId, name: row.name, suggestedQty: needed - leftover, basis };
    })
    .sort((a, b) => b.suggestedQty - a.suggestedQty);
}

/** One kind, specific, actionable note per "struggling" product (and a compliment for the "star"). */
export function gentleTruths(days = 14): GentleTruth[] {
  const rows = performanceRows(days);
  const since = isoAgo(days * DAY);
  const unitsByHour = db().prepare(
    `SELECT s.at, si.qty FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id = ? AND s.at >= ? AND s.at < ?`,
  );
  const pct = (change: number | null) => `${Math.abs(Math.round((change ?? 0) * 100))}%`;
  // Exact wording: if the earlier window was only partly covered, say it's a pace, not a count.
  const before = (row: PerformanceRow) =>
    row.prevIsEstimate ? `a pace of ${row.prevUnits} per ${days} days before that` : `${row.prevUnits} the ${days} days before`;

  const truths: GentleTruth[] = [];
  for (const row of rows.filter((r) => r.verdict === "struggling")) {
    // When does it still sell? Its best local hour in the window.
    const byHour = new Map<number, number>();
    for (const { at, qty } of unitsByHour.all(row.productId, since, isoAgo(0)) as unknown as { at: string; qty: number }[]) {
      const hour = new Date(at).getHours();
      byHour.set(hour, (byHour.get(hour) ?? 0) + qty);
    }
    const [bestHour, bestUnits] = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const marginEach = dollars(Math.round(row.revenueCents / Math.max(row.unitsSold, 1) - row.unitCostCents));
    truths.push({
      productId: row.productId,
      facts:
        `${row.name}: ${row.unitsSold} sold in the last ${days} days, down ${pct(row.change)} from ` +
        `${before(row)}. Margin ${marginEach} each.`,
      suggestion:
        bestHour === undefined
          ? `Try a smaller batch and a short price test.`
          : `It still sells best around ${hourName(bestHour)} (${bestUnits} of the ${row.unitsSold}). ` +
            `Bake a smaller batch and have it out fresh for then.`,
    });
  }

  const star = rows.find((r) => r.rank === 1);
  if (star) {
    truths.push({
      productId: star.productId,
      facts: `${star.name} is the best seller: ${star.unitsSold} sold in the last ${days} days, ${dollars(star.revenueCents)} in sales.`,
      suggestion: `Keep it front and centre, and never let it sell out before lunch.`,
    });
  }
  for (const row of rows.filter((r) => r.trend === "rising" && r.rank !== 1)) {
    truths.push({
      productId: row.productId,
      facts: `${row.name} is up ${pct(row.change)}: ${row.unitsSold} sold in the last ${days} days, from ${before(row)}.`,
      suggestion: `Customers are finding it. Give it a spot in the window sign.`,
    });
  }
  return truths;
}

/** Money lost to expired stock, by ingredient, over the last `days`. */
export function wasteSummary(days = 7): { ingredientId: string; name: string; costCents: number }[] {
  return db()
    .prepare(
      `SELECT w.ingredient_id AS ingredientId, i.name, SUM(w.cost_cents) AS costCents
         FROM waste_events w JOIN ingredients i ON i.id = w.ingredient_id
        WHERE w.at >= ? AND w.at <= ?
        GROUP BY w.ingredient_id
        ORDER BY costCents DESC`,
    )
    .all(isoAgo(days * DAY), isoAgo(0)) as unknown as { ingredientId: string; name: string; costCents: number }[];
}

/** The next closing time strictly after `t`. */
function nextClosing(t: Date): Date {
  const closing = new Date(t);
  closing.setHours(CLOSING_HOUR, 0, 0, 0);
  if (closing <= t) closing.setDate(closing.getDate() + 1);
  return closing;
}

/**
 * Called once at boot.
 *  - "sale.recorded" → recompute rushStatus; emit "rush.changed" when the label changes
 *  - "clock.changed" → when the demo clock crosses closing time (18:00), emit "insight.ready"
 * A 30-second tick does both checks too, so a rush ends (and the shop closes) even when
 * nothing else happens.
 */
export function registerAnalyticsListeners(): void {
  let lastLabel: RushStatus["label"] | undefined;
  let lastSeen = now();

  const checkRush = () => {
    const status = rushStatus();
    if (status.label !== lastLabel) {
      lastLabel = status.label;
      bus.emit("rush.changed", { status });
    }
  };
  const checkClosing = () => {
    const t = now();
    if (nextClosing(lastSeen) <= t) bus.emit("insight.ready", { truths: gentleTruths() });
    lastSeen = t;
  };
  const safely = (fn: () => void) => () => {
    try {
      fn();
    } catch (err) {
      console.error("[analytics]", err);
    }
  };

  bus.on("sale.recorded", safely(checkRush));
  bus.on("clock.changed", safely(() => (checkClosing(), checkRush())));
  setInterval(safely(() => (checkClosing(), checkRush())), 30_000).unref();
}
