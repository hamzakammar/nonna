// Lane 4. DELETE /api/menu/:id → take a treat off the menu (soft: active = 0).
import { handle } from "@/lib/api";
import { removeMenuItem } from "@/lib/catalog";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(() => removeMenuItem(id));
}
