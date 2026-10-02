// Lane 3. POST /api/sales/todo/:id  { done?: boolean }  → tick (default) or untick a line.
import { handle } from "@/lib/api";
import { setTaskDone } from "@/lib/sales/prep";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { done?: boolean };
  return handle(() => setTaskDone(id, body.done ?? true));
}
