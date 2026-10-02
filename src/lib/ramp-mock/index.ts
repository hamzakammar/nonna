/**
 * LANE 1: MOCK RAMP. A fake spend-management layer that every supplier
 * payment goes through.
 *
 * Shapes loosely follow Ramp's Developer API (cards, transactions, spend limits)
 * so a real `RampProvider` could replace this later. We do NOT call the real Ramp
 * API in this project. In the pitch it's one line: "expenses run on Ramp-style
 * cards: one per supplier, each with a limit." Don't make it bigger than that.
 */
import type { RampCard, RampTransaction } from "@/lib/types";
import { db, id } from "@/lib/db";
import { now, nowIso, DAY } from "@/lib/clock";

export interface PaymentsProvider {
  listCards(): RampCard[];
  getCard(cardId: string): RampCard;
  /** Spend in the rolling last 7 days (demo clock). Refunds count as negative. */
  weeklySpendCents(cardId: string): number;
  /**
   * Charge a supplier's card. Throws `CardDeclinedError` if the card isn't
   * ACTIVE, or if the charge would push the rolling 7-day spend over spendLimitCents.
   */
  charge(input: { cardId: string; amountCents: number; merchantName: string; memo?: string }): RampTransaction;
  /** Reverse a charge with a negative transaction on the same card. */
  refund(transactionId: string, memo?: string): RampTransaction;
  listTransactions(filter?: { cardId?: string; sinceIso?: string }): RampTransaction[];
  setCardState(cardId: string, state: RampCard["state"]): RampCard;
}

export class CardDeclinedError extends Error {
  constructor(public cardId: string, public reason: "suspended" | "over_limit") {
    super(`Card ${cardId} declined: ${reason}`);
  }
}

type R = Record<string, unknown>;

const toCard = (r: R): RampCard => ({
  id: String(r.id),
  displayName: String(r.display_name),
  lastFour: String(r.last_four),
  spendLimitCents: Number(r.spend_limit_cents),
  state: r.state as RampCard["state"],
});

const toTxn = (r: R): RampTransaction => ({
  id: String(r.id),
  cardId: String(r.card_id),
  merchantName: String(r.merchant_name),
  amountCents: Number(r.amount_cents),
  userTransactionTime: String(r.user_transaction_time),
  memo: r.memo ? String(r.memo) : undefined,
  receiptIds: JSON.parse(String(r.receipt_ids ?? "[]")) as string[],
});

function insertTxn(t: RampTransaction): RampTransaction {
  db()
    .prepare(
      "INSERT INTO ramp_transactions (id, card_id, merchant_name, amount_cents, user_transaction_time, memo, receipt_ids) VALUES (?,?,?,?,?,?,?)",
    )
    .run(t.id, t.cardId, t.merchantName, t.amountCents, t.userTransactionTime, t.memo ?? null, JSON.stringify(t.receiptIds));
  return t;
}

export const payments: PaymentsProvider = {
  listCards() {
    return db().prepare("SELECT * FROM ramp_cards ORDER BY display_name").all().map(toCard);
  },

  getCard(cardId) {
    const row = db().prepare("SELECT * FROM ramp_cards WHERE id = ?").get(cardId);
    if (!row) throw new Error(`Unknown card ${cardId}`);
    return toCard(row);
  },

  weeklySpendCents(cardId) {
    const since = new Date(now().getTime() - 7 * DAY).toISOString();
    const row = db()
      .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM ramp_transactions WHERE card_id = ? AND user_transaction_time > ?")
      .get(cardId, since) as { s: number };
    return row.s;
  },

  charge({ cardId, amountCents, merchantName, memo }) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error(`Invalid charge amount ${amountCents}`);
    const card = payments.getCard(cardId);
    if (card.state !== "ACTIVE") throw new CardDeclinedError(cardId, "suspended");
    if (payments.weeklySpendCents(cardId) + amountCents > card.spendLimitCents) {
      throw new CardDeclinedError(cardId, "over_limit");
    }
    return insertTxn({ id: id("txn"), cardId, merchantName, amountCents, userTransactionTime: nowIso(), memo, receiptIds: [] });
  },

  refund(transactionId, memo) {
    const row = db().prepare("SELECT * FROM ramp_transactions WHERE id = ?").get(transactionId);
    if (!row) throw new Error(`Unknown transaction ${transactionId}`);
    const original = toTxn(row);
    return insertTxn({
      id: id("txn"),
      cardId: original.cardId,
      merchantName: original.merchantName,
      amountCents: -original.amountCents,
      userTransactionTime: nowIso(),
      memo: memo ?? `Refund of ${original.id}`,
      receiptIds: [],
    });
  },

  listTransactions(filter = {}) {
    const where: string[] = [];
    const args: string[] = [];
    if (filter.cardId) { where.push("card_id = ?"); args.push(filter.cardId); }
    if (filter.sinceIso) { where.push("user_transaction_time > ?"); args.push(filter.sinceIso); }
    const sql = `SELECT * FROM ramp_transactions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY user_transaction_time DESC`;
    return db().prepare(sql).all(...args).map(toTxn);
  },

  setCardState(cardId, state) {
    db().prepare("UPDATE ramp_cards SET state = ? WHERE id = ?").run(state, cardId);
    return payments.getCard(cardId);
  },
};
