/**
 * Polite page fetching for Price Watch: honest User-Agent, robots.txt
 * respected, 10s timeout, 2MB cap. Only competitors' OWN public websites are
 * fetched, never Google Maps pages.
 *
 * `mock://<slug>/<path>` URLs are served from ./fixtures/<slug>/ so the whole
 * pipeline runs offline in tests and demos. The same files are viewable at
 * /mock/<slug>/ in the app.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const USER_AGENT = "NonnaPriceWatch/0.1 (small family bakery price check; +https://github.com/hamzakammar/nonna)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
export const FIXTURES_DIR = path.join(process.cwd(), "src", "lib", "pricewatch", "fixtures");

export class RobotsBlockedError extends Error {}

// ---------- mock:// ----------

const g = globalThis as unknown as { __nonnaMockVariant?: string };

/** Demo lever: "sale" makes mock sites serve their *-sale.html variants (The Bakery drops its parfait price). */
export function setMockVariant(variant: string | undefined): void {
  g.__nonnaMockVariant = variant;
}

/** Resolve a mock:// URL (or a /mock/<slug>/… path) to a fixture file, or undefined if none. */
export function mockFile(slug: string, pagePath: string): string | undefined {
  const clean = pagePath.replace(/^\/+|\/+$/g, "") || "index";
  if (clean.includes("..")) return undefined;
  const base = path.join(FIXTURES_DIR, slug, clean);
  const variant = g.__nonnaMockVariant;
  const candidates = [
    ...(variant ? [`${base}-${variant}.html`] : []),
    `${base}.html`,
    base, // robots.txt, reviews.json
  ];
  return candidates.find((c) => existsSync(c) && !c.endsWith(path.sep));
}

function readMock(url: URL): string {
  const file = mockFile(url.hostname, url.pathname);
  if (!file) throw new Error(`404 ${url.href}`);
  return readFileSync(file, "utf8");
}

// ---------- robots.txt ----------

/**
 * Minimal robots.txt check: rules in the `User-agent: *` group (or one naming us),
 * longest matching Allow/Disallow prefix wins. Good enough for small-business sites.
 */
export function robotsAllows(robotsTxt: string, pathname: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | undefined;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (key.toLowerCase() === "user-agent") {
      if (!current || current.rules.length > 0) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if (current && value) {
      current.rules.push({ allow: key.toLowerCase() === "allow", path: value });
    }
  }
  const ours = groups.find((gr) => gr.agents.some((a) => a !== "*" && USER_AGENT.toLowerCase().includes(a)));
  const group = ours ?? groups.find((gr) => gr.agents.includes("*"));
  if (!group) return true;
  const match = group.rules.filter((r) => pathname.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return match ? match.allow : true;
}

const robotsCache = new Map<string, string>();

async function rawFetch(url: URL): Promise<string> {
  if (url.protocol === "mock:") return readMock(url);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`Unsupported URL ${url.href}`);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${url.href}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error(`Page too large (${len} bytes)`);
  const text = await res.text();
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
}

/** Fetch a page if the site's robots.txt allows it. Throws RobotsBlockedError otherwise. */
export async function fetchPage(href: string): Promise<{ url: string; html: string }> {
  const url = new URL(href);
  const origin = `${url.protocol}//${url.host}`;
  if (!robotsCache.has(origin)) {
    let robots = "";
    try {
      robots = await rawFetch(new URL("/robots.txt", origin + "/"));
    } catch {
      robots = ""; // no robots.txt = no restrictions
    }
    robotsCache.set(origin, robots);
  }
  if (!robotsAllows(robotsCache.get(origin)!, url.pathname || "/")) throw new RobotsBlockedError(`robots.txt disallows ${url.href}`);
  return { url: url.href, html: await rawFetch(url) };
}

export function clearRobotsCache(): void {
  robotsCache.clear();
}
