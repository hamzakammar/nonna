// Lane 1. GET /api/pricewatch → competitors (how found, last check), latest prices, pricing advice, refresh status.
import { handle } from "@/lib/api";
import { latestPrices, listCompetitors, priceAdvice } from "@/lib/pricewatch";
import { apiUsage, discoveryProvider } from "@/lib/pricewatch/discovery";
import { lastRefreshAt } from "@/lib/pricewatch/refresh";

export async function GET() {
  return handle(() => ({
    competitors: listCompetitors(),
    prices: latestPrices(),
    advice: priceAdvice(),
    refresh: { provider: discoveryProvider(), lastRefreshAt: lastRefreshAt(), googleUsage: apiUsage() },
  }));
}
