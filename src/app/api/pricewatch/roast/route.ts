// Lane 1. POST /api/pricewatch/roast { competitorId?, spice?: 1|2|3, seed?, count?: 1–100 }: Nonna's Petty Mode 😤 (the review bot).
// Parody drafts about a FICTIONAL (mock) rival. Real businesses are refused (403). Nothing is ever posted.
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { roastCompetitor, RoastRefusedError, type Spice } from "@/lib/pricewatch/roast";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { competitorId?: string; spice?: Spice; seed?: number; count?: number };
  return handle(async () => {
    try {
      return await roastCompetitor(body.competitorId ?? "comp_bakery", body.spice ?? 2, body.seed, body.count ?? 3);
    } catch (err) {
      if (err instanceof RoastRefusedError) return NextResponse.json({ error: err.message }, { status: 403 });
      throw err;
    }
  });
}
