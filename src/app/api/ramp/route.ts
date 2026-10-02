// Lane 1. GET /api/ramp → supplier cards with rolling 7-day spend, recent transactions, and Nonna's autopilot allowance.
import { handle } from "@/lib/api";
import { payments } from "@/lib/ramp-mock";
import { autopilotStatus } from "@/lib/inventory";

export async function GET() {
  return handle(() => ({
    cards: payments.listCards().map((card) => ({ ...card, weeklySpendCents: payments.weeklySpendCents(card.id) })),
    transactions: payments.listTransactions().slice(0, 20),
    autopilot: autopilotStatus(),
  }));
}
