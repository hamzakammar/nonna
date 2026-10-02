/**
 * Finding competitors near the shop, with no typing by Grandma. Providers
 * (PRICEWATCH_DISCOVERY):
 *   - "mock" (default): ./fixtures/places.json, offline, used for the demo
 *   - "osm": OpenStreetMap Overpass API. Free, no key, no card. Bakeries/cafés
 *     within the radius, with their website tag.
 *   - "google": Places API Text Search (New). ONE call returns up to 20 bakeries
 *     with website + reviews. Kept inside Google's free monthly quota by a hard
 *     cap (GOOGLE_PLACES_MONTHLY_CAP, default 900 calls). Past the cap it refuses, never bills.
 *     Google still needs a billing account on file even for free-tier use.
 * No provider scrapes Google Maps pages.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { FIXTURES_DIR } from "./fetch";

export interface DiscoveredPlace {
  externalId: string; // "mock:the-bakery" | "osm:node/123" | "google:ChIJ…"
  name: string; // in-run display only; google names are not stored (see refresh.ts)
  website?: string;
  /** Live review texts (google/mock). Never stored. */
  reviews?: string[];
}

export type DiscoveryProvider = "mock" | "osm" | "google";

export interface ShopLocation {
  lat: number;
  lng: number;
  radiusM: number;
  name: string; // our own name, excluded from results
}

export function shopLocation(): ShopLocation {
  return {
    lat: Number(process.env.SHOP_LAT ?? 43.4643), // default: Uptown Waterloo, ON
    lng: Number(process.env.SHOP_LNG ?? -80.5204),
    radiusM: Number(process.env.PRICEWATCH_RADIUS_M ?? 2000),
    name: process.env.SHOP_NAME ?? "Nonna's Bakery",
  };
}

export const discoveryProvider = (): DiscoveryProvider => (process.env.PRICEWATCH_DISCOVERY as DiscoveryProvider) ?? "mock";

const USER_AGENT = "NonnaPriceWatch/0.1 (+https://github.com/hamzakammar/nonna)";

// ---------- mock ----------

function discoverMock(): DiscoveredPlace[] {
  const { places } = JSON.parse(readFileSync(path.join(FIXTURES_DIR, "places.json"), "utf8")) as { places: DiscoveredPlace[] };
  return places.map((p) => {
    const slug = p.externalId.replace(/^mock:/, "");
    let reviews: string[] | undefined;
    try {
      reviews = (JSON.parse(readFileSync(path.join(FIXTURES_DIR, slug, "reviews.json"), "utf8")) as { reviews: { text: string }[] }).reviews.map((r) => r.text);
    } catch {
      reviews = undefined;
    }
    return { ...p, reviews };
  });
}

// ---------- OpenStreetMap (free) ----------

/**
 * Overpass QL: bakeries and pastry shops within the radius. Exact tag matches
 * only: regex filters and extra café clauses made the public servers time out (504).
 */
export function overpassQuery(loc: ShopLocation): string {
  const around = `(around:${loc.radiusM},${loc.lat},${loc.lng})`;
  return `[out:json][timeout:25];
(
  nw["shop"="bakery"]${around};
  nw["shop"="pastry"]${around};
);
out tags 50;`;
}

/** Public Overpass servers; busy ones answer 429/504, so fall through to the next. */
const OVERPASS_SERVERS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

async function discoverOsm(loc: ShopLocation): Promise<DiscoveredPlace[]> {
  type OverpassJson = { elements: { type: string; id: number; tags?: Record<string, string> }[] };
  let json: OverpassJson | undefined;
  const errors: string[] = [];
  // Busy servers recover within seconds: try each twice before moving on.
  const attempts = OVERPASS_SERVERS.flatMap((server) => [server, server]);
  for (const [i, server] of attempts.entries()) {
    if (json) break;
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: overpassQuery(loc) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      json = (await res.json()) as OverpassJson;
    } catch (err) {
      errors.push(`${new URL(server).host}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!json) throw new Error(`All Overpass servers failed (${errors.join("; ")})`);
  return json.elements
    .filter((e) => e.tags?.name)
    .map((e) => ({
      externalId: `osm:${e.type}/${e.id}`,
      name: e.tags!.name,
      website: e.tags!.website ?? e.tags!["contact:website"] ?? e.tags!.url,
    }));
}

// ---------- Google Places (free tier only) ----------

const GOOGLE_SKU = "places_text_search_enterprise_atmosphere"; // websiteUri + reviews in the field mask

export class FreeTierCapError extends Error {}

const month = () => now().toISOString().slice(0, 7);

export function apiUsage(sku = GOOGLE_SKU): { month: string; count: number; cap: number } {
  const row = db().prepare("SELECT count FROM api_usage WHERE month = ? AND sku = ?").get(month(), sku) as { count: number } | undefined;
  return { month: month(), count: row?.count ?? 0, cap: Number(process.env.GOOGLE_PLACES_MONTHLY_CAP ?? 900) };
}

/** Count a call BEFORE making it; refuse if it would pass the monthly cap. */
function reserveCall(sku: string): void {
  const { count, cap } = apiUsage(sku);
  if (count >= cap) throw new FreeTierCapError(`Google Places free-tier cap reached (${count}/${cap} this month)`);
  db()
    .prepare("INSERT INTO api_usage (month, sku, count) VALUES (?, ?, 1) ON CONFLICT(month, sku) DO UPDATE SET count = count + 1")
    .run(month(), sku);
}

async function discoverGoogle(loc: ShopLocation): Promise<DiscoveredPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("PRICEWATCH_DISCOVERY=google needs GOOGLE_PLACES_API_KEY");
  reserveCall(GOOGLE_SKU);
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.websiteUri,places.reviews",
    },
    body: JSON.stringify({
      textQuery: "bakery",
      pageSize: 20,
      locationBias: { circle: { center: { latitude: loc.lat, longitude: loc.lng }, radius: Math.min(loc.radiusM, 50_000) } },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    places?: { id: string; displayName?: { text: string }; websiteUri?: string; reviews?: { text?: { text: string } }[] }[];
  };
  return (json.places ?? []).map((p) => ({
    externalId: `google:${p.id}`,
    name: p.displayName?.text ?? "Nearby bakery",
    website: p.websiteUri,
    reviews: p.reviews?.map((r) => r.text?.text ?? "").filter(Boolean),
  }));
}

export async function discover(provider = discoveryProvider(), loc = shopLocation()): Promise<DiscoveredPlace[]> {
  const places = provider === "google" ? await discoverGoogle(loc) : provider === "osm" ? await discoverOsm(loc) : discoverMock();
  const self = loc.name.toLowerCase();
  return places.filter((p) => p.name.toLowerCase() !== self);
}
