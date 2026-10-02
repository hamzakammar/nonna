/**
 * LANE 1: NONNA'S PETTY MODE 😤. A stage joke.
 *
 * Nonna drafts outrageously petty one-star "reviews" of the rival bakery,
 * built from real Price Watch numbers. Then, when you hit "Post to Google",
 * she refuses. The veto IS the punchline.
 *
 * Deliberate limits (keep them if you edit this):
 *  - Mock competitors only. Price Watch can discover REAL bakeries (OSM/Google),
 *    and roasting those is refused.
 *  - Nothing is ever posted anywhere: there's no Google/Yelp integration, and
 *    postRoast() always returns posted: false.
 *  - Drafts are absurd on purpose (cats filing complaints), not believable fake reviews.
 */
import type { CompetitorPrice } from "@/lib/types";
import { db } from "@/lib/db";
import { latestPrices, listCompetitors } from "./index";
import { discover, shopLocation } from "./discovery";
import { reviewPriceSignal } from "./reviews";

export type Spice = 1 | 2 | 3;
export const SPICE_LABELS: Record<Spice, string> = { 1: "mildly disappointed", 2: "personally offended", 3: "Nonna has been to war" };

export class RoastRefusedError extends Error {}

interface Facts {
  competitor: string;
  item: string;
  theirPrice: string;
  ourPrice: string;
  ourShop: string;
  diff: string;
  pricey: string; // e.g. "3 of 5" (live review signal), or "" if unknown
}

type Template = { stars: number; text: (f: Facts) => string };

const TEMPLATES: Record<Spice, Template[]> = {
  1: [
    { stars: 2, text: (f) => `The ${f.item} at ${f.competitor} was ${f.theirPrice}. It was fine. Fine like a beige wall. Nonna's is ${f.ourPrice} and has feelings.` },
    { stars: 2, text: (f) => `Ordered the ${f.item}. It tasted like it was made by someone who has heard of a ${f.item.toLowerCase()} but never met one.` },
    { stars: 2, text: (f) => `${f.competitor}'s ${f.item}: ${f.theirPrice}. Perfectly adequate, if your standards were raised by wolves.` },
  ],
  2: [
    { stars: 1, text: (f) => `${f.theirPrice} for the ${f.item}?! For that money I expect it to do my taxes. It did not do my taxes.` },
    { stars: 1, text: (f) => `The ${f.item} at ${f.competitor} has the structural integrity of a wet napkin. ${f.ourShop} would never.` },
    { stars: 1, text: (f) => `I asked ${f.competitor} where their ingredients come from. They pointed at a truck. Not a farm. A TRUCK.` },
    { stars: 1, text: (f) => (f.pricey ? `Even their own customers agree: ${f.pricey} recent reviews call ${f.competitor} pricey. I agree with the customers. I am the customers now.` : `${f.competitor}: where the prices are high and the parfaits are low.`) },
  ],
  3: [
    { stars: 1, text: (f) => `ZERO stars (Google made me pick one). I survived three wars and the cream shortage of 1987, but I did not survive ${f.competitor}'s ${f.item}. ${f.theirPrice}. SHAME. Two blocks away it's ${f.ourPrice} and made with love and spite.` },
    { stars: 1, text: (f) => `I brought ${f.competitor}'s ${f.item} home and my cat filed a complaint with the city.` },
    { stars: 1, text: (f) => `${f.competitor} charges ${f.diff} more than ${f.ourShop} for a worse ${f.item}. I have informed my priest. He is also disappointed.` },
    { stars: 1, text: (f) => `I would rather eat my own rolling pin than another ${f.item} from ${f.competitor}. At least the rolling pin is honest.` },
  ],
};

const VETOES = [
  "Absolutely not. We beat them with better parfaits, not lies.",
  "Tesoro. I said roast them, not commit fraud. Put the phone down.",
  "Nonna does not lie on the internet. Nonna only lies about her age.",
  "We don't do that here. Go make 14 parfaits instead. That's the real revenge.",
  "Delete it. Then bake. Spite is an ingredient, not a business plan.",
];

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;
/** Small deterministic PRNG so a `seed` gives the same drafts (tests, rehearsals). */
const pick = <T,>(arr: T[], seed: number, salt: number) => arr[Math.abs(Math.imul(seed + 1, 2654435761) ^ (salt * 40503)) % arr.length];

/** Their matched items, most "they charge more than us" first. */
function rivalItems(competitorId: string) {
  const ours = new Map(
    (db().prepare("SELECT id, name, price_cents FROM products").all() as { id: string; name: string; price_cents: number }[]).map((p) => [p.id, p]),
  );
  return latestPrices(competitorId)
    .filter((p): p is CompetitorPrice & { productId: string } => Boolean(p.productId && ours.has(p.productId)))
    .map((p) => ({ theirs: p, ours: ours.get(p.productId)! }))
    .sort((a, b) => b.theirs.priceCents - b.ours.price_cents - (a.theirs.priceCents - a.ours.price_cents));
}

export async function roastCompetitor(competitorId: string, spice: Spice = 2, seed = Math.floor(Math.random() * 1e6)) {
  const competitor = listCompetitors().find((c) => c.id === competitorId);
  if (!competitor) throw new Error(`Unknown competitor ${competitorId}`);
  if (competitor.source !== "mock") {
    throw new RoastRefusedError(`${competitor.name} is a real business. Nonna only roasts the fictional ones.`);
  }
  if (![1, 2, 3].includes(spice)) throw new Error("Spice is 1, 2 or 3");

  const items = rivalItems(competitor.id);
  if (!items.length) throw new Error(`Nonna knows nothing about ${competitor.name}'s menu yet. Run a Price Watch refresh first.`);

  // Live review signal for the mock competitor (never stored).
  const place = (await discover("mock")).find((p) => p.externalId === competitor.externalId);
  const signal = place?.reviews?.length ? reviewPriceSignal(place.reviews) : undefined;

  const templates = TEMPLATES[spice];
  const drafts = [0, 1, 2].map((i) => {
    const { theirs, ours } = items[i % Math.min(items.length, 2)]; // focus the fire on the worst offenders
    const facts: Facts = {
      competitor: competitor.name,
      item: theirs.itemName,
      theirPrice: $(theirs.priceCents),
      ourPrice: $(ours.price_cents),
      ourShop: shopLocation().name,
      diff: $(Math.max(theirs.priceCents - ours.price_cents, 0)),
      pricey: signal?.saysPricey ? `${signal.saysPricey} of ${signal.reviewsRead}` : "",
    };
    const t = templates[(templates.indexOf(pick(templates, seed, 0)) + i) % templates.length];
    return { stars: t.stars, text: t.text(facts) };
  });

  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    spice,
    spiceLabel: SPICE_LABELS[spice],
    drafts,
    parody: true as const,
    notice: "Parody for a hackathon demo. Fictional bakery. Never posted anywhere.",
  };
}

/** The punchline: Nonna refuses. Nothing is posted, ever. */
export function postRoast(seed = Math.floor(Math.random() * 1e6)): { posted: false; nonna: string } {
  return { posted: false, nonna: pick(VETOES, seed, 1) };
}
