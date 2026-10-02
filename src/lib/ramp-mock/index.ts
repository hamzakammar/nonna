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
import { todo } from "@/lib/todo";

export interface PaymentsProvider {
  listCards(): RampCard[];
  /**
   * Charge a supplier's card. Throws `CardDeclinedError` if the card is
   * SUSPENDED, or if the charge would push this week's spend over spendLimitCents.
   */
  charge(input: { cardId: string; amountCents: number; merchantName: string; memo?: string }): RampTransaction;
  listTransactions(filter?: { cardId?: string; sinceIso?: string }): RampTransaction[];
  setCardState(cardId: string, state: RampCard["state"]): RampCard;
}

export class CardDeclinedError extends Error {
  constructor(public cardId: string, public reason: "suspended" | "over_limit") {
    super(`Card ${cardId} declined: ${reason}`);
  }
}

export const payments: PaymentsProvider = {
  listCards: () => todo("lane1 ramp.listCards"),
  charge: () => todo("lane1 ramp.charge"),
  listTransactions: () => todo("lane1 ramp.listTransactions"),
  setCardState: () => todo("lane1 ramp.setCardState"),
};
