/**
 * What reviews say about a competitor's prices. Keyword counts plus "$X"
 * mentions, with no AI. Computed live from review text and never stored:
 * Google's terms don't allow caching review content, so only the counts travel
 * further (in the refresh report and event), never the reviews themselves.
 */
import type { ReviewPriceSignal } from "@/lib/types";
import { toCents } from "./menu";

const PRICEY = /\b(over-?priced|expensive|pricey|steep|rip-?off|too much)\b/i;
const VALUE = /\b(cheap|good value|great value|affordable|worth (it|every penny)|reasonabl[ey])\b/i;
const PRICE = /\$\s?(\d{1,3}(?:\.\d{2})?)/g;

export function reviewPriceSignal(reviews: string[]): ReviewPriceSignal {
  const signal: ReviewPriceSignal = { reviewsRead: reviews.length, saysPricey: 0, saysGoodValue: 0, mentions: [] };
  for (const text of reviews) {
    if (PRICEY.test(text)) signal.saysPricey++;
    if (VALUE.test(text)) signal.saysGoodValue++;
    for (const m of text.matchAll(PRICE)) {
      const cents = toCents(m[1]);
      if (!cents) continue;
      const start = Math.max(0, (m.index ?? 0) - 30);
      signal.mentions.push({ snippet: text.slice(start, (m.index ?? 0) + m[0].length + 30).trim(), priceCents: cents });
    }
  }
  return signal;
}
