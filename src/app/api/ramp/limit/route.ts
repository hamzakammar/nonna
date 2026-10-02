// Lane 1. POST /api/ramp/limit { cardId, newLimitCents, thenApproveReorderId? }
// Grandma said "yes, raise it" after a card.declined. Refuses more than 2× (or +$100) in one go.
import { handle } from "@/lib/api";
import { raiseCardLimit } from "@/lib/inventory";

export async function POST(req: Request) {
  const { cardId, newLimitCents, thenApproveReorderId } = (await req.json()) as { cardId: string; newLimitCents: number; thenApproveReorderId?: string };
  return handle(() => raiseCardLimit(cardId, newLimitCents, thenApproveReorderId));
}
