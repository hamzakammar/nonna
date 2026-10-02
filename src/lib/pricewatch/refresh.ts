/**
 * The automatic Price Watch loop. Once a day on the demo clock (or on demand):
 *   discover nearby bakeries → read each one's own website menu → record ONLY
 *   prices that changed → `competitor.prices` (Nonna: "The Bakery dropped their
 *   parfait to $6.95") + live review signal.
 */
import type { Competitor, CompetitorRefresh } from "@/lib/types";
import { bus } from "@/lib/events";
import { db, id } from "@/lib/db";
import { now, nowIso, DAY, HOUR } from "@/lib/clock";
import { discover, discoveryProvider, type DiscoveredPlace, type DiscoveryProvider } from "./discovery";
import { RobotsBlockedError } from "./fetch";
import { findMenu } from "./menu";
import { reviewPriceSignal } from "./reviews";
import { latestPrices, recordPrices, toCompetitor } from "./index";
import { hasCredentials, readMenuText } from "./vision";

const REFRESH_EVERY_MS = DAY;

/**
 * Find or create the competitor row for a discovered place.
 * Google: only the place id (allowed to be stored) plus a placeholder name until
 * we've read their own website. Google's name/website aren't cached.
 */
function upsertCompetitor(place: DiscoveredPlace, provider: DiscoveryProvider): { competitor: Competitor; isNew: boolean } {
  const conn = db();
  const byExternal = conn.prepare("SELECT * FROM competitors WHERE external_id = ?").get(place.externalId);
  if (byExternal) return { competitor: toCompetitor(byExternal), isNew: false };

  const storedName = provider === "google" ? "Nearby bakery" : place.name;
  // Adopt a manually-added competitor with the same name instead of duplicating it.
  const byName = conn.prepare("SELECT * FROM competitors WHERE external_id IS NULL AND lower(name) = lower(?)").get(place.name);
  if (byName) {
    conn.prepare("UPDATE competitors SET external_id = ?, source = ? WHERE id = ?").run(place.externalId, provider, String(byName.id));
    return { competitor: toCompetitor({ ...byName, external_id: place.externalId, source: provider }), isNew: false };
  }
  const row = { id: id("comp"), name: storedName, source: provider, external_id: place.externalId };
  conn.prepare("INSERT INTO competitors (id, name, source, external_id) VALUES (?,?,?,?)").run(row.id, row.name, row.source, row.external_id);
  return { competitor: toCompetitor(row), isNew: true };
}

function markChecked(competitorId: string, status: CompetitorRefresh["status"], extra: { website?: string; name?: string } = {}) {
  const sets = ["last_checked_at = ?", "last_status = ?"];
  const args: string[] = [nowIso(), status];
  if (extra.website) { sets.push("website = ?"); args.push(extra.website); }
  if (extra.name) { sets.push("name = ?"); args.push(extra.name); }
  db().prepare(`UPDATE competitors SET ${sets.join(", ")} WHERE id = ?`).run(...args, competitorId);
}

async function refreshOne(place: DiscoveredPlace, provider: DiscoveryProvider): Promise<CompetitorRefresh> {
  const { competitor, isNew } = upsertCompetitor(place, provider);
  if (isNew) bus.emit("competitor.discovered", { competitor });
  const base: CompetitorRefresh = {
    competitorId: competitor.id,
    name: place.name,
    source: provider,
    status: "ok",
    itemsFound: 0,
    changed: [],
    reviews: place.reviews?.length ? reviewPriceSignal(place.reviews) : undefined,
  };
  if (!place.website) {
    markChecked(competitor.id, "no_website");
    return { ...base, status: "no_website" };
  }
  try {
    const menu = await findMenu(place.website, { claudeFallback: hasCredentials() ? readMenuText : undefined });
    // Our own crawl: safe to store the website and the name the site gives itself.
    const nameUpdate = provider === "google" && menu?.siteName ? { name: menu.siteName } : {};
    if (!menu) {
      markChecked(competitor.id, "no_menu_found", { website: place.website, ...nameUpdate });
      return { ...base, status: "no_menu_found" };
    }
    const last = new Map(latestPrices(competitor.id).map((p) => [p.itemName.toLowerCase(), p.priceCents]));
    const changedItems = menu.items.filter((i) => last.get(i.itemName.toLowerCase()) !== i.priceCents);
    const changed = changedItems.length ? recordPrices(competitor.id, changedItems, "website").prices : [];
    const status = changed.length ? "ok" : "unchanged";
    markChecked(competitor.id, status, { website: place.website, ...nameUpdate });
    return { ...base, status, menuUrl: menu.menuUrl, method: menu.method, itemsFound: menu.items.length, changed };
  } catch (err) {
    if (err instanceof RobotsBlockedError) {
      markChecked(competitor.id, "robots_blocked");
      return { ...base, status: "robots_blocked" };
    }
    markChecked(competitor.id, "error");
    return { ...base, status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

const g = globalThis as unknown as { __nonnaPwRunning?: Promise<unknown> };

/** Run the whole loop now. Concurrent calls share one run. */
export async function refreshCompetitors(provider = discoveryProvider()): Promise<{ provider: DiscoveryProvider; at: string; results: CompetitorRefresh[] }> {
  if (g.__nonnaPwRunning) return g.__nonnaPwRunning as ReturnType<typeof refreshCompetitors>;
  const run = (async () => {
    const places = await discover(provider);
    const results: CompetitorRefresh[] = [];
    for (const place of places) results.push(await refreshOne(place, provider)); // one site at a time: polite
    return { provider, at: nowIso(), results };
  })();
  g.__nonnaPwRunning = run;
  try {
    return await run;
  } finally {
    g.__nonnaPwRunning = undefined;
  }
}

export function lastRefreshAt(): string | undefined {
  const row = db().prepare("SELECT MAX(last_checked_at) AS t FROM competitors").get() as { t: string | null };
  return row.t ?? undefined;
}

/** Daily schedule on the demo clock. Off with PRICEWATCH_AUTO=0. */
export function registerPriceWatchListeners(): void {
  if (process.env.PRICEWATCH_AUTO === "0") return;
  const maybeRefresh = () => {
    const last = lastRefreshAt();
    if (last && now().getTime() - new Date(last).getTime() < REFRESH_EVERY_MS) return;
    refreshCompetitors().catch((err) => console.error("[pricewatch] refresh failed", err));
  };
  bus.on("clock.changed", maybeRefresh);
  setInterval(maybeRefresh, HOUR).unref();
  setTimeout(maybeRefresh, 0);
}
