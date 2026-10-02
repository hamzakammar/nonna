// Lane 1
import { handle } from "@/lib/api";
import { listReorders, proposeReorder } from "@/lib/inventory";

export async function GET() {
  return handle(() => listReorders());
}

/** Manual reorder: { ingredientId, qty? } */
export async function POST(req: Request) {
  const { ingredientId, qty } = (await req.json()) as { ingredientId: string; qty?: number };
  return handle(() => proposeReorder(ingredientId, "manual", qty));
}
