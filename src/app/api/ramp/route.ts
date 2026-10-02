// Lane 1. GET /api/ramp → supplier cards with rolling 7-day spend + recent transactions (for the dashboard's Ramp panel).
import { handle } from "@/lib/api";
import { payments } from "@/lib/ramp-mock";

export async function GET() {
  return handle(() => ({
    cards: payments.listCards().map((card) => ({ ...card, weeklySpendCents: payments.weeklySpendCents(card.id) })),
    transactions: payments.listTransactions().slice(0, 20),
  }));
}
