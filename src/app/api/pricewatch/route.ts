// Lane 1. GET /api/pricewatch → competitors, their latest prices, and our pricing advice.
import { handle } from "@/lib/api";
import { latestPrices, listCompetitors, priceAdvice } from "@/lib/pricewatch";

export async function GET() {
  return handle(() => ({ competitors: listCompetitors(), prices: latestPrices(), advice: priceAdvice() }));
}
