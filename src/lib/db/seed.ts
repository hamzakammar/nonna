/**
 * Baseline seed: the catalogue, starting stock and mock Ramp cards. Owned by Lane 1.
 *
 * Stock is set up so the demo starts with things already happening:
 *   - heavy cream is just above its reorder point (a couple of parfaits tip it over)
 *   - mixed berries expire in ~20h (already "expiring soon")
 *   - milk expires in ~36h
 * Sales history is NOT seeded here. Lane 3's simulator (`npm run simulate`) adds it.
 */
import { db, tx } from "./index";
import { now, DAY, HOUR } from "../clock";

type Row = Record<string, string | number | null>;

function insert(table: string, row: Row) {
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
  db().prepare(sql).run(...Object.values(row));
}

const SUPPLIERS = [
  { id: "sup_gerald", name: "Gerald's Dairy", contact: "gerald@geraldsdairy.example", lead_time_hours: 12, is_local: 0 },
  { id: "sup_rosa", name: "Rosa's Orchard", contact: "(519) 555-0142", lead_time_hours: 24, is_local: 1 },
  { id: "sup_dave", name: "Dave's Pumpkin Patch", contact: "(519) 555-0177", lead_time_hours: 24, is_local: 1 },
  { id: "sup_bulk", name: "BulkMart Wholesale", contact: "orders@bulkmart.example", lead_time_hours: 48, is_local: 0 },
  { id: "sup_bean", name: "Bean There Roasters", contact: "(519) 555-0110", lead_time_hours: 24, is_local: 1 },
];

// unit_cost_cents = cents per ONE base unit (g / ml / pcs)
const INGREDIENTS = [
  { id: "ing_cream", name: "Heavy cream", unit: "ml", reorder_point: 1500, reorder_qty: 4000, unit_cost_cents: 0.5, shelf_life_days: 7, supplier_id: "sup_gerald" },
  { id: "ing_milk", name: "Whole milk", unit: "ml", reorder_point: 3000, reorder_qty: 8000, unit_cost_cents: 0.15, shelf_life_days: 6, supplier_id: "sup_gerald" },
  { id: "ing_yogurt", name: "Greek yogurt", unit: "g", reorder_point: 2000, reorder_qty: 5000, unit_cost_cents: 0.6, shelf_life_days: 10, supplier_id: "sup_gerald" },
  { id: "ing_mascarpone", name: "Mascarpone", unit: "g", reorder_point: 700, reorder_qty: 2000, unit_cost_cents: 1.6, shelf_life_days: 8, supplier_id: "sup_gerald" },
  { id: "ing_butter", name: "Butter", unit: "g", reorder_point: 1500, reorder_qty: 4000, unit_cost_cents: 1.2, shelf_life_days: 30, supplier_id: "sup_gerald" },
  { id: "ing_apples", name: "Apples", unit: "g", reorder_point: 2000, reorder_qty: 6000, unit_cost_cents: 0.4, shelf_life_days: 14, supplier_id: "sup_rosa" },
  { id: "ing_berries", name: "Mixed berries", unit: "g", reorder_point: 1000, reorder_qty: 3000, unit_cost_cents: 1.5, shelf_life_days: 4, supplier_id: "sup_rosa" },
  { id: "ing_pumpkin", name: "Pumpkin purée", unit: "g", reorder_point: 1000, reorder_qty: 3000, unit_cost_cents: 0.5, shelf_life_days: 7, supplier_id: "sup_dave" },
  { id: "ing_flour", name: "Flour", unit: "g", reorder_point: 4000, reorder_qty: 10000, unit_cost_cents: 0.15, shelf_life_days: 180, supplier_id: "sup_bulk" },
  { id: "ing_sugar", name: "Sugar", unit: "g", reorder_point: 2000, reorder_qty: 5000, unit_cost_cents: 0.2, shelf_life_days: 365, supplier_id: "sup_bulk" },
  { id: "ing_granola", name: "Granola", unit: "g", reorder_point: 1000, reorder_qty: 3000, unit_cost_cents: 1.2, shelf_life_days: 60, supplier_id: "sup_bulk" },
  { id: "ing_eggs", name: "Eggs", unit: "pcs", reorder_point: 24, reorder_qty: 90, unit_cost_cents: 40, shelf_life_days: 21, supplier_id: "sup_bulk" },
  { id: "ing_cups", name: "Parfait cups", unit: "pcs", reorder_point: 40, reorder_qty: 200, unit_cost_cents: 15, shelf_life_days: 3650, supplier_id: "sup_bulk" },
  { id: "ing_coffee", name: "Espresso beans", unit: "g", reorder_point: 800, reorder_qty: 2500, unit_cost_cents: 3, shelf_life_days: 30, supplier_id: "sup_bean" },
];

const PRODUCTS = [
  { id: "prd_fall_parfait", name: "Fall Parfait", emoji: "🍂", price_cents: 750, category: "parfait" },
  { id: "prd_berry_parfait", name: "Berry Parfait", emoji: "🍓", price_cents: 700, category: "parfait" },
  { id: "prd_apple_pie", name: "Apple Pie (slice)", emoji: "🥧", price_cents: 550, category: "pie" },
  { id: "prd_croissant", name: "Croissant", emoji: "🥐", price_cents: 375, category: "pastry" },
  { id: "prd_tiramisu", name: "Tiramisu Cup", emoji: "🍮", price_cents: 650, category: "other" },
  { id: "prd_pumpkin_loaf", name: "Pumpkin Loaf (slice)", emoji: "🎃", price_cents: 425, category: "pastry" },
  { id: "prd_espresso", name: "Espresso", emoji: "☕", price_cents: 300, category: "drink" },
  { id: "prd_latte", name: "Latte", emoji: "🥛", price_cents: 475, category: "drink" },
];

// [product, ingredient, qty per unit]
const RECIPES: [string, string, number][] = [
  ["prd_fall_parfait", "ing_yogurt", 150], ["prd_fall_parfait", "ing_pumpkin", 60], ["prd_fall_parfait", "ing_granola", 40], ["prd_fall_parfait", "ing_cream", 30], ["prd_fall_parfait", "ing_cups", 1],
  ["prd_berry_parfait", "ing_yogurt", 150], ["prd_berry_parfait", "ing_berries", 80], ["prd_berry_parfait", "ing_granola", 40], ["prd_berry_parfait", "ing_cups", 1],
  ["prd_apple_pie", "ing_apples", 120], ["prd_apple_pie", "ing_flour", 50], ["prd_apple_pie", "ing_butter", 30], ["prd_apple_pie", "ing_sugar", 20], ["prd_apple_pie", "ing_eggs", 0.2],
  ["prd_croissant", "ing_flour", 60], ["prd_croissant", "ing_butter", 35], ["prd_croissant", "ing_milk", 15], ["prd_croissant", "ing_eggs", 0.1], ["prd_croissant", "ing_sugar", 8],
  ["prd_tiramisu", "ing_mascarpone", 70], ["prd_tiramisu", "ing_eggs", 0.5], ["prd_tiramisu", "ing_sugar", 15], ["prd_tiramisu", "ing_coffee", 5], ["prd_tiramisu", "ing_cream", 20], ["prd_tiramisu", "ing_cups", 1],
  ["prd_pumpkin_loaf", "ing_pumpkin", 50], ["prd_pumpkin_loaf", "ing_flour", 45], ["prd_pumpkin_loaf", "ing_sugar", 25], ["prd_pumpkin_loaf", "ing_eggs", 0.3], ["prd_pumpkin_loaf", "ing_butter", 15],
  ["prd_espresso", "ing_coffee", 18],
  ["prd_latte", "ing_coffee", 18], ["prd_latte", "ing_milk", 220],
];

// [ingredient, qty, received N days ago, expires in N days]
const LOTS: [string, number, number, number][] = [
  ["ing_cream", 1700, 3, 4], // just above reorder point (1500)
  ["ing_milk", 9000, 4, 1.5], // expires in ~36h
  ["ing_yogurt", 6000, 2, 8],
  ["ing_mascarpone", 1800, 2, 6],
  ["ing_butter", 5000, 5, 25],
  ["ing_apples", 7000, 3, 11],
  ["ing_berries", 2200, 3, 0.75], // expires in ~20h: "expiring soon" at demo start, dead after "+1 day"
  ["ing_pumpkin", 3000, 1, 6],
  ["ing_flour", 15000, 10, 170],
  ["ing_sugar", 8000, 20, 345],
  ["ing_granola", 3500, 5, 55],
  ["ing_eggs", 90, 2, 19],
  ["ing_cups", 250, 30, 3000],
  ["ing_coffee", 2600, 4, 26],
];

const CARDS = [
  { id: "card_gerald", display_name: "Gerald's Dairy card", last_four: "4421", spend_limit_cents: 60000, supplier: "sup_gerald" },
  { id: "card_rosa", display_name: "Rosa's Orchard card", last_four: "1187", spend_limit_cents: 30000, supplier: "sup_rosa" },
  { id: "card_dave", display_name: "Dave's Pumpkin Patch card", last_four: "9032", spend_limit_cents: 20000, supplier: "sup_dave" },
  { id: "card_bulk", display_name: "BulkMart card", last_four: "5566", spend_limit_cents: 80000, supplier: "sup_bulk" },
  { id: "card_bean", display_name: "Bean There card", last_four: "7703", spend_limit_cents: 25000, supplier: "sup_bean" },
];

export function seed() {
  const t = now().getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  tx(() => {
    for (const c of CARDS) {
      insert("ramp_cards", { id: c.id, display_name: c.display_name, last_four: c.last_four, spend_limit_cents: c.spend_limit_cents, state: "ACTIVE" });
    }
    for (const s of SUPPLIERS) {
      insert("suppliers", { ...s, ramp_card_id: CARDS.find((c) => c.supplier === s.id)?.id ?? null });
    }
    for (const i of INGREDIENTS) insert("ingredients", i);
    for (const p of PRODUCTS) insert("products", { ...p, active: 1 });
    for (const [product_id, ingredient_id, qty_per_unit] of RECIPES) {
      insert("recipe_items", { product_id, ingredient_id, qty_per_unit });
    }
    LOTS.forEach(([ingredient_id, qty, receivedAgo, expiresIn], n) => {
      insert("stock_lots", {
        id: `lot_seed_${n}`,
        ingredient_id,
        qty_remaining: qty,
        received_at: iso(t - receivedAgo * DAY),
        expires_at: iso(t + expiresIn * DAY + 2 * HOUR),
      });
    });
  });
}
