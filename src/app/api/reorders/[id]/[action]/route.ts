// Lane 1. POST /api/reorders/:id/approve | cancel | receive
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { approveReorder, cancelReorder, receiveReorder } from "@/lib/inventory";
import { CardDeclinedError } from "@/lib/ramp-mock";

const ACTIONS = { approve: approveReorder, cancel: cancelReorder, receive: receiveReorder };

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params;
  const run = ACTIONS[action as keyof typeof ACTIONS];
  return handle(() => {
    if (!run) throw new Error(`Unknown action ${action}`);
    try {
      return run(id);
    } catch (err) {
      // 402: the reorder stays "proposed", so the UI/voice can tell Grandma the card is maxed or frozen.
      if (err instanceof CardDeclinedError) {
        return NextResponse.json({ error: err.message, declined: err.reason, cardId: err.cardId }, { status: 402 });
      }
      throw err;
    }
  });
}
