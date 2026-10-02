// Display helpers. Money comes in integer cents, quantities in base units (g / ml / pcs).
import type { Unit } from "@/lib/types";

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** 1500 ml → "1.5 litres", 250 g → "250 grams", 3 pcs → "3". Words, not abbreviations. */
export function amount(qty: number, unit: Unit): string {
  if (unit === "ml") return qty >= 1000 ? `${trim(qty / 1000)} ${qty === 1000 ? "litre" : "litres"}` : `${trim(qty)} ml`;
  if (unit === "g") return qty >= 1000 ? `${trim(qty / 1000)} kg` : `${trim(qty)} grams`;
  return trim(qty);
}

/** "3" pcs reads better with the name: "3 eggs". Grams/ml read better as "250 grams of flour". */
export function amountOf(qty: number, unit: Unit, name: string): string {
  return unit === "pcs" ? `${trim(qty)} × ${name}` : `${amount(qty, unit)} of ${name.toLowerCase()}`;
}

export const UNIT_WORDS: Record<Unit, { verb: string; word: string; emoji: string }> = {
  g: { verb: "Weigh it", word: "grams", emoji: "⚖️" },
  ml: { verb: "Pour it", word: "ml", emoji: "💧" },
  pcs: { verb: "Count it", word: "pieces", emoji: "🔢" },
};

const INGREDIENT_EMOJI: [RegExp, string][] = [
  [/cream|milk/i, "🥛"],
  [/yog/i, "🍶"],
  [/mascarpone|cheese|ricotta/i, "🧀"],
  [/butter/i, "🧈"],
  [/apple/i, "🍎"],
  [/strawberr/i, "🍓"],
  [/berr/i, "🍇"],
  [/lemon/i, "🍋"],
  [/banana/i, "🍌"],
  [/pumpkin/i, "🎃"],
  [/flour/i, "🌾"],
  [/sugar|honey/i, "🍯"],
  [/granola|oat/i, "🥣"],
  [/egg/i, "🥚"],
  [/coffee|espresso|bean/i, "☕"],
  [/cup|box|bag/i, "🥤"],
  [/choc|cocoa/i, "🍫"],
  [/nut|almond|pecan|walnut/i, "🥜"],
  [/cinnamon|spice|vanilla/i, "🌰"],
  [/maple|syrup/i, "🍁"],
];

// Order matters: the first match wins, so specific words come before general ones ("cheesecake" before "cake").
const TREAT_EMOJI: [RegExp, string][] = [
  [/cheesecake|cake|torte|gateau/i, "🍰"],
  [/cupcake|muffin/i, "🧁"],
  [/birthday/i, "🎂"],
  [/pie|tart|quiche/i, "🥧"],
  [/cookie|biscotti|biscuit|amaretti/i, "🍪"],
  [/donut|doughnut|bombolon|zeppol/i, "🍩"],
  [/croissant|cornetto/i, "🥐"],
  [/baguette|focaccia|ciabatta/i, "🥖"],
  [/bread|loaf|brioche|panettone/i, "🍞"],
  [/pretzel|bun|twist|cinnamon roll/i, "🥨"],
  [/tiramisu|pudding|custard|flan|panna cotta|cannol/i, "🍮"],
  [/gelato|ice cream|sundae|sorbet/i, "🍨"],
  [/parfait/i, "🍨"],
  [/choc|brownie|fudge/i, "🍫"],
  [/strawberr|berry/i, "🍓"],
  [/apple/i, "🍎"],
  [/lemon|limon/i, "🍋"],
  [/peach/i, "🍑"],
  [/cherr/i, "🍒"],
  [/pumpkin|squash/i, "🎃"],
  [/fall|autumn|maple/i, "🍂"],
  [/espresso|coffee|latte|cappuccino|mocha|americano/i, "☕"],
  [/\btea\b|chai/i, "🍵"],
  [/milk|shake|smoothie/i, "🥛"],
  [/pizza/i, "🍕"],
  [/sandwich|panini/i, "🥪"],
];

/** Picks a picture from the treat's name, so Grandma never has to. */
export function treatEmoji(name: string): string {
  return TREAT_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🍰";
}

export function ingredientEmoji(name: string): string {
  return INGREDIENT_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🧺";
}

/** "in 20 hours" / "in 3 days" / "today!" for an ISO time, relative to `nowMs` (the demo clock). */
export function fromNow(iso: string, nowMs: number): string {
  const hours = (new Date(iso).getTime() - nowMs) / 3_600_000;
  if (hours <= 0) return "already gone off";
  if (hours < 1) return "within the hour!";
  if (hours < 36) return `in ${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  if (days > 365) return "in more than a year";
  return `in ${days} days`;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function hourLabel(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}
