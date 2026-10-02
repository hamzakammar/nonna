// Lane 1. POST /api/pricewatch/apply { productId, priceCents }: Grandma said yes to a new price.
// Refuses prices below the margin floor (400).
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { setPrice } from "@/lib/pricewatch";

export async function POST(req: Request) {
  const { productId, priceCents } = (await req.json()) as { productId: string; priceCents: number };
  return handle(() => {
    try {
      return setPrice(productId, priceCents);
    } catch (err) {
      if (err instanceof Error && err.message.includes("below the margin floor")) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }
  });
}
