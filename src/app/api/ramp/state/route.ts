// Lane 1. POST /api/ramp/state { cardId, state: "ACTIVE" | "SUSPENDED" }: freeze or unfreeze a supplier's card.
// Frozen cards decline every charge (approve → 402), so "cutting up Gerald's card" stops all his orders.
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { payments } from "@/lib/ramp-mock";

export async function POST(req: Request) {
  const { cardId, state } = (await req.json()) as { cardId: string; state: "ACTIVE" | "SUSPENDED" };
  return handle(() => {
    if (state !== "ACTIVE" && state !== "SUSPENDED") return NextResponse.json({ error: "state must be ACTIVE or SUSPENDED" }, { status: 400 });
    return payments.setCardState(cardId, state);
  });
}
