/**
 * LANE 1: NONNA'S NOTEBOOK. Every card charge, written the way Nonna would
 * write it in the margin of her ledger.
 * The facts (amount, supplier, item, date) are exact. Only the commentary is
 * personality, and it's chosen by deterministic rules, not an LLM.
 */
import { db } from "@/lib/db";
import { now, DAY } from "@/lib/clock";
import { payments } from "./index";

export type NotebookMood = "happy" | "proud" | "worried";

export interface NotebookEntry {
  id: string;
  at: string;
  cardId: string;
  merchantName: string;
  amountCents: number;
  item?: string; // "heavy cream", parsed from the memo
  autopilot: boolean; // placed by Nonna's allowance, without asking
  line: string; // Nonna's note
  mood: NotebookMood;
}

const $ = (c: number) => `$${(Math.abs(c) / 100).toFixed(2)}`;

/** Memos look like "Reorder ro_x: 4000ml Heavy cream" or "Weekly order: 9000ml Whole milk". */
function itemFromMemo(memo: string | null): string | undefined {
  const m = memo?.match(/:\s*[\d.]+\s*(?:ml|g|pcs)?\s+(.+)$/i);
  return m?.[1]?.toLowerCase();
}

export function notebookEntries(limit = 30): NotebookEntry[] {
  const rows = db()
    .prepare(
      `SELECT t.*, COALESCE(r.auto_approved, 0) AS auto_approved, COALESCE(s.is_local, 0) AS is_local
       FROM ramp_transactions t
       LEFT JOIN reorders r ON r.ramp_transaction_id = t.id
       LEFT JOIN suppliers s ON s.ramp_card_id = t.card_id
       ORDER BY t.user_transaction_time DESC LIMIT ?`,
    )
    .all(limit) as {
    id: string; card_id: string; merchant_name: string; amount_cents: number;
    user_transaction_time: string; memo: string | null; auto_approved: number; is_local: number;
  }[];

  const weekAgo = new Date(now().getTime() - 7 * DAY).toISOString();
  const countThisWeek = db().prepare("SELECT COUNT(*) AS n FROM ramp_transactions WHERE card_id = ? AND amount_cents > 0 AND user_transaction_time > ? AND user_transaction_time <= ?");

  return rows.map((r) => {
    const item = itemFromMemo(r.memo);
    const what = item ? ` for ${item}` : "";
    const base = { id: r.id, at: r.user_transaction_time, cardId: r.card_id, merchantName: r.merchant_name, amountCents: r.amount_cents, item, autopilot: r.auto_approved === 1 };
    const timesThisWeek = (countThisWeek.get(r.card_id, weekAgo, r.user_transaction_time) as { n: number }).n;

    let line: string;
    let mood: NotebookMood = "happy";
    if (r.amount_cents < 0) {
      line = `Got ${$(r.amount_cents)} back from ${r.merchant_name}. As it should be.`;
      mood = "proud";
    } else if (r.auto_approved === 1) {
      line = `${$(r.amount_cents)}${what}. I did this one myself, under my allowance. You're welcome.`;
      mood = "proud";
    } else if (r.amount_cents >= 5000) {
      line = `${$(r.amount_cents)} to ${r.merchant_name}${what}. Mamma mia. It better be good.`;
      mood = "worried";
    } else if (timesThisWeek >= 3) {
      line = `${$(r.amount_cents)} to ${r.merchant_name}${what}. Again. That's ${timesThisWeek} times this week.`;
      mood = "worried";
    } else if (r.is_local === 1) {
      line = `${$(r.amount_cents)} to ${r.merchant_name}${what}. Local, so I don't mind.`;
    } else {
      line = `${$(r.amount_cents)} to ${r.merchant_name}${what}.`;
    }
    return { ...base, line, mood };
  });
}

/** Header numbers for the Notebook page: this week's spend and each card's room left. */
export function notebookSummary() {
  const cards = payments.listCards().map((c) => {
    const weeklySpendCents = payments.weeklySpendCents(c.id);
    return { ...c, weeklySpendCents, usedPct: c.spendLimitCents ? Math.round((weeklySpendCents / c.spendLimitCents) * 100) : 0 };
  });
  const weekTotalCents = cards.reduce((s, c) => s + c.weeklySpendCents, 0);
  const tightest = [...cards].filter((c) => c.state === "ACTIVE").sort((a, b) => b.usedPct - a.usedPct)[0];
  return { weekTotalCents, cards, tightest };
}
