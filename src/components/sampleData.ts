// Stand-in numbers for screens whose backend isn't built yet (the API answers 501).
// Pages show a "Sample numbers" tag while these are in use. Delete once Lane 3 ships analytics.
import type { BusynessBucket, GentleTruth, ProductPerformance, RushStatus } from "@/lib/types";

export const SAMPLE_PRODUCTS: ProductPerformance[] = [
  { productId: "prd_croissant", name: "Croissant", unitsSold: 142, revenueCents: 53250, marginCents: 41800, trend: "steady", rank: 1, verdict: "star" },
  { productId: "prd_fall_parfait", name: "Fall Parfait", unitsSold: 98, revenueCents: 73500, marginCents: 52100, trend: "rising", rank: 2, verdict: "star" },
  { productId: "prd_latte", name: "Latte", unitsSold: 87, revenueCents: 41325, marginCents: 33900, trend: "steady", rank: 3, verdict: "solid" },
  { productId: "prd_espresso", name: "Espresso", unitsSold: 64, revenueCents: 19200, marginCents: 17100, trend: "steady", rank: 4, verdict: "solid" },
  { productId: "prd_berry_parfait", name: "Berry Parfait", unitsSold: 51, revenueCents: 35700, marginCents: 22400, trend: "steady", rank: 5, verdict: "solid" },
  { productId: "prd_tiramisu", name: "Tiramisu Cup", unitsSold: 38, revenueCents: 24700, marginCents: 16900, trend: "rising", rank: 6, verdict: "solid" },
  { productId: "prd_pumpkin_loaf", name: "Pumpkin Loaf (slice)", unitsSold: 29, revenueCents: 12325, marginCents: 9800, trend: "steady", rank: 7, verdict: "solid" },
  { productId: "prd_apple_pie", name: "Apple Pie (slice)", unitsSold: 17, revenueCents: 9350, marginCents: 6100, trend: "falling", rank: 8, verdict: "struggling" },
];

// Coffee peak 7:30–9:30, lunch peak 11:30–13:30, dead around 3pm. Saturday busiest, Monday quietest.
const DAY_FACTOR = [0.9, 0.55, 0.7, 0.75, 0.85, 1.05, 1.4];
const HOUR_SHAPE: Record<number, number> = { 7: 6, 8: 11, 9: 9, 10: 6, 11: 8, 12: 12, 13: 9, 14: 5, 15: 3, 16: 4, 17: 3 };

export const SAMPLE_BUSYNESS: BusynessBucket[] = DAY_FACTOR.flatMap((f, dayOfWeek) =>
  Object.entries(HOUR_SHAPE).map(([h, base]) => {
    const salesPerHour = Math.round(base * f * 10) / 10;
    const level = (salesPerHour >= 12 ? 4 : salesPerHour >= 9 ? 3 : salesPerHour >= 6 ? 2 : salesPerHour >= 3 ? 1 : 0) as BusynessBucket["level"];
    return { dayOfWeek, hour: Number(h), salesPerHour, level };
  }),
);

export const SAMPLE_RUSH: RushStatus = { now: 1, label: "steady" };

export const SAMPLE_TRUTHS: GentleTruth[] = [
  {
    productId: "prd_apple_pie",
    facts: "Apple Pie: 31 slices in the last 14 days, down 42% from 53.",
    suggestion: "It still sells in the afternoon. Try it warm with a little cream after 2 pm.",
  },
  {
    productId: "prd_fall_parfait",
    facts: "Fall Parfait is a star: 98 sold this week, up from 61.",
    suggestion: "Make a few more on Saturday morning, it sells out by noon.",
  },
];
