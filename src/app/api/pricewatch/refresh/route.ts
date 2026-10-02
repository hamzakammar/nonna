// Lane 1. POST /api/pricewatch/refresh { provider?: "mock" | "osm" | "google", mockVariant?: "sale" }
// Runs the automatic loop now: discover → read menus → record changes. It also runs daily on its own.
// mockVariant "sale" = demo lever: The Bakery's mock site drops its parfait to $6.95.
import { handle } from "@/lib/api";
import { refreshCompetitors } from "@/lib/pricewatch/refresh";
import { setMockVariant } from "@/lib/pricewatch/fetch";
import type { DiscoveryProvider } from "@/lib/pricewatch/discovery";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { provider?: DiscoveryProvider; mockVariant?: string | null };
  return handle(() => {
    if (body.mockVariant !== undefined) setMockVariant(body.mockVariant ?? undefined);
    return refreshCompetitors(body.provider);
  });
}
