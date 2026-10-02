// Lane 1. POST /api/reorders/:id/approve | cancel | receive
import { handle } from "@/lib/api";
import { approveReorder, cancelReorder, receiveReorder } from "@/lib/inventory";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params;
  return handle(() => {
    if (action === "approve") return approveReorder(id);
    if (action === "cancel") return cancelReorder(id);
    if (action === "receive") return receiveReorder(id);
    throw new Error(`Unknown action ${action}`);
  });
}
