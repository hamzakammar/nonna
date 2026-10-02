/**
 * LANE 3: THE LEDGER. The make-list.
 *
 * Builds itself during the day, with nobody typing anything in:
 *   1. Morning batch: once per day, one line per product for the shelf, sized by prepForecast().
 *   2. Orders: when a sale needs more than the shelf has left, the shortfall becomes
 *      "make N for this customer". Phone or university orders can also be added by hand.
 * Drinks are made to order at the machine, so they never go on the list.
 *
 * Shelf left = morning batch − units sold today that came off the shelf.
 * (A unit made for an order goes straight to the customer, never onto the shelf.)
 */
import type { AddOrderInput, PrepTask, Sale } from "@/lib/types";
import { db, id, tx } from "@/lib/db";
import { bus } from "@/lib/events";
import { now, nowIso } from "@/lib/clock";
import { prepForecast } from "@/lib/analytics";

const OPEN_HOUR = 7;

type TaskRow = {
  id: string;
  day: string;
  product_id: string;
  name: string;
  emoji: string;
  qty: number;
  kind: PrepTask["kind"];
  note: string;
  due_at: string | null;
  sale_id: string | null;
  created_at: string;
  done_at: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day, "2026-10-03". The shop's day, not UTC's. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayBounds(day: string): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
}

function isDrink(productId: string): boolean {
  const row = db().prepare("SELECT category FROM products WHERE id = ?").get(productId) as { category: string } | undefined;
  return row?.category === "drink";
}

/** Create the day's morning batch from the forecast, once. Safe to call as often as you like. */
export function ensureMorningBatch(day = dayKey(now())): void {
  const exists = db().prepare("SELECT 1 FROM prep_tasks WHERE day = ? AND kind = 'morning' LIMIT 1").get(day);
  if (exists) return;
  const opening = dayBounds(day).start;
  opening.setHours(OPEN_HOUR);
  const insert = db().prepare(
    `INSERT INTO prep_tasks (id, day, product_id, qty, kind, note, due_at, created_at)
     VALUES (?, ?, ?, ?, 'morning', ?, ?, ?)`,
  );
  tx(() => {
    for (const p of prepForecast(day)) {
      if (p.suggestedQty > 0) insert.run(id("task"), day, p.productId, p.suggestedQty, `for the shelf (${p.basis})`, opening.toISOString(), nowIso());
    }
  });
}

/** Units of `productId` the shelf still has, not counting sale `excludeSaleId`. */
function shelfLeft(productId: string, day: string, excludeSaleId: string): number {
  const { start, end } = dayBounds(day);
  const q = (sql: string, ...args: (string | number)[]) => (db().prepare(sql).get(...args) as { n: number }).n;
  const morning = q("SELECT COALESCE(SUM(qty), 0) AS n FROM prep_tasks WHERE day = ? AND product_id = ? AND kind = 'morning'", day, productId);
  const sold = q(
    `SELECT COALESCE(SUM(si.qty), 0) AS n FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id = ? AND s.at >= ? AND s.at < ? AND s.id != ?`,
    productId, start.toISOString(), end.toISOString(), excludeSaleId,
  );
  const madeToOrder = q(
    "SELECT COALESCE(SUM(qty), 0) AS n FROM prep_tasks WHERE day = ? AND product_id = ? AND kind = 'order' AND sale_id IS NOT NULL",
    day, productId,
  );
  return Math.max(0, morning - (sold - madeToOrder));
}

/** A sale came in: whatever the shelf can't cover goes on the list. Returns the tasks it added. */
export function addShortfalls(sale: Sale): PrepTask[] {
  const at = new Date(sale.at);
  const day = dayKey(at);
  ensureMorningBatch(day);
  const added: string[] = [];
  for (const item of sale.items) {
    if (isDrink(item.productId)) continue;
    const short = item.qty - shelfLeft(item.productId, day, sale.id);
    if (short <= 0) continue;
    const taskId = id("task");
    db()
      .prepare(
        `INSERT INTO prep_tasks (id, day, product_id, qty, kind, note, sale_id, created_at)
         VALUES (?, ?, ?, ?, 'order', ?, ?, ?)`,
      )
      .run(taskId, day, item.productId, short, `counter order at ${pad(at.getHours())}:${pad(at.getMinutes())}, shelf was out`, sale.id, nowIso());
    added.push(taskId);
  }
  return added.map(getTask);
}

/** Add an order by hand: a phone call, a university event, … It doesn't come off the shelf. */
export function addOrder(input: AddOrderInput): PrepTask {
  const product = db().prepare("SELECT active FROM products WHERE id = ?").get(input.productId) as { active: number } | undefined;
  if (!product) throw new Error(`Unknown product ${input.productId}`);
  if (!product.active) throw new Error(`${input.productId} is not on the menu right now`);
  if (!Number.isInteger(input.qty) || input.qty <= 0) {
    throw new Error(`Quantity must be a whole number above 0 (got ${input.qty})`);
  }
  const due = input.dueAt ? new Date(input.dueAt) : undefined;
  if (due && Number.isNaN(due.getTime())) throw new Error(`Can't read due time "${input.dueAt}"`);

  const taskId = id("task");
  db()
    .prepare(
      `INSERT INTO prep_tasks (id, day, product_id, qty, kind, note, due_at, created_at)
       VALUES (?, ?, ?, ?, 'order', ?, ?, ?)`,
    )
    .run(taskId, dayKey(due ?? now()), input.productId, input.qty, input.note?.trim() || "order", due?.toISOString() ?? null, nowIso());
  return getTask(taskId);
}

/** Tick (or untick) a line. */
export function setTaskDone(taskId: string, done = true): PrepTask {
  getTask(taskId); // throws if unknown
  db().prepare("UPDATE prep_tasks SET done_at = ? WHERE id = ?").run(done ? nowIso() : null, taskId);
  return getTask(taskId);
}

const SELECT_TASK = `SELECT t.*, p.name, p.emoji FROM prep_tasks t JOIN products p ON p.id = t.product_id`;

function toTask(row: TaskRow): PrepTask {
  return {
    id: row.id,
    day: row.day,
    productId: row.product_id,
    name: row.name,
    emoji: row.emoji,
    qty: row.qty,
    kind: row.kind,
    note: row.note,
    dueAt: row.due_at ?? undefined,
    saleId: row.sale_id ?? undefined,
    createdAt: row.created_at,
    doneAt: row.done_at ?? undefined,
  };
}

function getTask(taskId: string): PrepTask {
  const row = db().prepare(`${SELECT_TASK} WHERE t.id = ?`).get(taskId) as TaskRow | undefined;
  if (!row) throw new Error(`Unknown task ${taskId}`);
  return toTask(row);
}

/**
 * The day's list: still-to-do first, earliest due first (the morning batch is due at opening,
 * orders without a time go in the order they arrived), then what's done.
 */
export function listPrepTasks(day = dayKey(now())): PrepTask[] {
  ensureMorningBatch(day);
  const rows = db()
    .prepare(
      `${SELECT_TASK} WHERE t.day = ?
       ORDER BY t.done_at IS NOT NULL, COALESCE(t.due_at, t.created_at), t.created_at`,
    )
    .all(day) as unknown as TaskRow[];
  return rows.map(toTask);
}

/** The one thing Grandma should do next (for the kiosk), or null when the list is clear. */
export function nextPrepTask(): PrepTask | null {
  return listPrepTasks().find((t) => !t.doneAt) ?? null;
}

export function registerPrepListeners(): void {
  bus.on("sale.recorded", ({ sale }) => {
    addShortfalls(sale);
  });
  // A new day starts with a fresh morning batch, even before the first sale.
  bus.on("clock.changed", ({ now: iso }) => {
    ensureMorningBatch(dayKey(new Date(iso)));
  });
}
