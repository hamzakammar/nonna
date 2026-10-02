// Lane 1. POST /api/pricewatch/prices: record prices heard by voice or typed in.
// { competitorId? | competitorName?, items: [{ itemName, priceCents, productId? }], source?: "voice" | "manual" }
import { handle } from "@/lib/api";
import { addCompetitor, recordPrices, type IncomingPrice } from "@/lib/pricewatch";

export async function POST(req: Request) {
  const body = (await req.json()) as { competitorId?: string; competitorName?: string; items: IncomingPrice[]; source?: "voice" | "manual" };
  return handle(() => {
    const competitorId = body.competitorId ?? addCompetitor(body.competitorName ?? "The Bakery").id;
    return recordPrices(competitorId, body.items ?? [], body.source === "voice" ? "voice" : "manual");
  });
}
