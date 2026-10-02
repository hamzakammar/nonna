// Lane 1. POST /api/suppliers/price { supplierId, ingredientId, unitCostCents } → PriceChange.
// The demo's "trade war" button: { supplierId: "sup_gerald", ingredientId: "ing_cream", unitCostCents: 0.95 }
import { handle } from "@/lib/api";
import { setOfferPrice } from "@/lib/inventory";

export async function POST(req: Request) {
  const { supplierId, ingredientId, unitCostCents } = (await req.json()) as { supplierId: string; ingredientId: string; unitCostCents: number };
  return handle(() => setOfferPrice(supplierId, ingredientId, unitCostCents));
}
