/**
 * Read a menu (items + prices) off a competitor's website, cheapest method first:
 *   1. their online store's public catalog. Most small bakeries sell online
 *      rather than posting a menu: Shopify `/products.json`, WooCommerce Store API.
 *      Exact, free, no AI. (Tested live on Waterloo bakeries.)
 *   2. schema.org JSON-LD (Menu / MenuItem / Product / Offer): exact, free, no AI
 *   3. plain-text lines like "Fall Harvest Parfait ........ $6.50": free, no AI
 *   4. Claude, only if 1–3 found nothing AND credentials exist (costs money)
 * All requests go through fetchPage, so robots.txt is respected.
 */
import type { CompetitorRefresh } from "@/lib/types";
import { fetchPage, RobotsBlockedError } from "./fetch";

export interface MenuItemPrice {
  itemName: string;
  priceCents: number;
}

export interface FoundMenu {
  menuUrl: string;
  siteName?: string;
  method: NonNullable<CompetitorRefresh["method"]>;
  items: MenuItemPrice[];
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");

export function toCents(price: unknown): number | undefined {
  const n = typeof price === "number" ? price : Number(String(price ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n >= 1000) return undefined;
  return Math.round(n * 100);
}

/** Site name from og:site_name, else <title> before any "|" / "—". */
export function siteNameOf(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.split(/\s[|—–-]\s/)[0];
  const name = decode((og ?? title ?? "").trim());
  return name || undefined;
}

// ---------- 1. JSON-LD ----------

export function parseJsonLd(html: string): MenuItemPrice[] {
  const items: MenuItemPrice[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const type = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if ((type.includes("MenuItem") || type.includes("Product")) && typeof o.name === "string") {
      const offer = ([] as unknown[]).concat(o.offers ?? [])[0] as Record<string, unknown> | undefined;
      const cents = toCents(offer?.price ?? offer?.lowPrice);
      if (cents) items.push({ itemName: decode(o.name.trim()), priceCents: cents });
    }
    Object.values(o).forEach(visit);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      // malformed JSON-LD: ignore this block
    }
  }
  return items;
}

// ---------- 0. Online store catalogs ----------

export type Platform = "shopify" | "woocommerce";

export function detectPlatform(html: string): Platform | undefined {
  if (/cdn\.shopify\.com|cdn\/shop\/|Shopify\.theme/i.test(html)) return "shopify";
  if (/wp-content\/plugins\/woocommerce|woocommerce|wc-block/i.test(html)) return "woocommerce";
  return undefined;
}

/** Not food: skip so "Gift Card $25" never gets compared with a parfait. */
const MERCH = /\b(gift ?card|tote|mug|t-?shirt|shirt|hoodie|sticker|merch|apron|candle|donation|shipping|tip)\b/i;
const MAX_ITEMS = 300;

/** Shopify's public storefront catalog: { products: [{ title, variants: [{ price: "9.35", available }] }] } */
export function parseShopifyProducts(json: unknown): MenuItemPrice[] {
  const products = (json as { products?: { title?: string; variants?: { price?: string; available?: boolean }[] }[] }).products ?? [];
  return products.flatMap((p) => {
    const variant = p.variants?.find((v) => v.available !== false) ?? p.variants?.[0];
    const cents = toCents(variant?.price);
    return p.title && cents ? [{ itemName: decode(p.title.trim()), priceCents: cents }] : [];
  });
}

/** WooCommerce Store API: [{ name, prices: { price: "1599", currency_minor_unit: 2 } }] */
export function parseWooProducts(json: unknown): MenuItemPrice[] {
  if (!Array.isArray(json)) return [];
  return (json as { name?: string; prices?: { price?: string; currency_minor_unit?: number } }[]).flatMap((p) => {
    const minor = p.prices?.currency_minor_unit ?? 2;
    const raw = Number(p.prices?.price);
    const cents = Number.isFinite(raw) && raw > 0 ? Math.round(raw * 10 ** (2 - minor)) : undefined;
    return p.name && cents && cents < 100_000 ? [{ itemName: decode(p.name.trim()), priceCents: cents }] : [];
  });
}

async function readCatalog(platform: Platform, origin: string): Promise<MenuItemPrice[]> {
  const url = platform === "shopify" ? `${origin}/products.json?limit=250` : `${origin}/wp-json/wc/store/v1/products?per_page=100`;
  const { html } = await fetchPage(url);
  const json = JSON.parse(html) as unknown;
  const items = platform === "shopify" ? parseShopifyProducts(json) : parseWooProducts(json);
  return items.filter((i) => !MERCH.test(i.itemName)).slice(0, MAX_ITEMS);
}

// ---------- 2. Plain text ----------

/** Visible text, one line per block element. */
export function htmlToLines(html: string): string[] {
  return decode(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/?(li|p|div|tr|br|h[1-6]|section|article|td)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const LINE = /^([A-Za-zÀ-ÿ'&][A-Za-zÀ-ÿ'&\s.-]{2,60}?)\s*(?:\.{2,}|…|[-–—:·])?\s*\$\s?(\d{1,3}(?:\.\d{2})?)\s*$/;

/** Lines that are just "Item name <dots/dash> $price". Phone numbers, hours and prose don't match. */
export function parseTextLines(html: string): MenuItemPrice[] {
  const items: MenuItemPrice[] = [];
  for (const line of htmlToLines(html)) {
    const m = line.match(LINE);
    const cents = m && toCents(m[2]);
    const name = m?.[1].replace(/[\s.\-–—:·]+$/, "").trim();
    if (name && cents && name.split(" ").length <= 8) items.push({ itemName: name, priceCents: cents });
  }
  return items;
}

// ---------- finding the menu page ----------

/** Same-site links whose text or href says "menu", best first. */
export function menuLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links: { href: string; score: number }[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (/\.(png|jpe?g|gif|svg|webp|css|js|ico)(\?|$)/i.test(m[1])) continue;
    const text = m[2].replace(/<[^>]+>/g, "").toLowerCase();
    const href = m[1];
    const score = (/menu/.test(text) ? 2 : 0) + (/menu/i.test(href) ? 1 : 0);
    if (!score) continue;
    try {
      const abs = new URL(href, base);
      if (abs.host === base.host) links.push({ href: abs.href, score });
    } catch {
      // bad href
    }
  }
  return [...new Set(links.sort((a, b) => b.score - a.score).map((l) => l.href))].slice(0, 3);
}

const dedupe = (items: MenuItemPrice[]) => {
  const seen = new Map<string, MenuItemPrice>();
  for (const i of items) if (!seen.has(i.itemName.toLowerCase())) seen.set(i.itemName.toLowerCase(), i);
  return [...seen.values()];
};

/**
 * Find and read a competitor's menu: homepage first, then up to 3 "menu" links.
 * Returns undefined when no prices can be found (status "no_menu_found").
 * Throws RobotsBlockedError if the site asks bots to stay out.
 */
export async function findMenu(website: string, opts: { claudeFallback?: (text: string) => Promise<MenuItemPrice[]> } = {}): Promise<FoundMenu | undefined> {
  const home = await fetchPage(website);
  const siteName = siteNameOf(home.html);
  const platform = detectPlatform(home.html);
  if (platform) {
    const u = new URL(home.url);
    const origin = `${u.protocol}//${u.host}`; // URL.origin is "null" for mock:// URLs
    try {
      const items = dedupe(await readCatalog(platform, origin));
      if (items.length) return { menuUrl: home.url, siteName, method: platform, items };
    } catch (err) {
      if (err instanceof RobotsBlockedError) throw err;
      // catalog disabled or unreachable: fall through to page parsing
    }
  }
  const pages = [home];
  for (const href of menuLinks(home.html, home.url)) {
    try {
      pages.push(await fetchPage(href));
    } catch {
      // one broken link shouldn't stop us
    }
  }
  // Prefer a dedicated menu page over the homepage.
  for (const page of [...pages.slice(1), pages[0]]) {
    const ld = parseJsonLd(page.html);
    if (ld.length) return { menuUrl: page.url, siteName, method: "json-ld", items: dedupe(ld) };
  }
  for (const page of [...pages.slice(1), pages[0]]) {
    const text = parseTextLines(page.html);
    if (text.length >= 2) return { menuUrl: page.url, siteName, method: "text", items: dedupe(text) };
  }
  if (opts.claudeFallback) {
    const page = pages[1] ?? pages[0];
    const items = await opts.claudeFallback(htmlToLines(page.html).join("\n").slice(0, 20_000));
    if (items.length) return { menuUrl: page.url, siteName, method: "claude", items: dedupe(items) };
  }
  return undefined;
}
