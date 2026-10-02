/**
 * The menu Grandma edits: add a treat with its recipe, take one off the menu.
 * Server-only. Written for the Shop Window's menu screens; it touches catalogue
 * tables (products, recipe_items, and ingredients + supplier_offers for brand-new
 * ingredients) and goes through Lane 1's public API for anything to do with stock.
 */
import type { Unit } from "@/lib/types";
import { db, id, tx } from "@/lib/db";
import { proposeReorder } from "@/lib/inventory";
import type { MenuItem, NewIngredientInput, NewMenuItemInput, NewMenuItemResult } from "./types";

const UNITS: Unit[] = ["g", "ml", "pcs"];

export function listMenu(): MenuItem[] {
  const recipe = db().prepare(
    "SELECT ri.ingredient_id, ri.qty_per_unit, i.name, i.unit FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.product_id = ? ORDER BY i.name",
  );
  return db()
    .prepare("SELECT * FROM products WHERE active = 1 ORDER BY name")
    .all()
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      emoji: String(r.emoji),
      priceCents: Number(r.price_cents),
      category: String(r.category) as MenuItem["category"],
      active: true,
      recipe: recipe.all(String(r.id)).map((x) => ({
        ingredientId: String(x.ingredient_id),
        name: String(x.name),
        unit: String(x.unit) as Unit,
        qtyPerUnit: Number(x.qty_per_unit),
      })),
    }));
}

function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

function createIngredient(input: NewIngredientInput, qtyPerUnit: number): string {
  const name = input.name.trim();
  check(name, "The new ingredient needs a name");
  check(UNITS.includes(input.unit), `Unknown unit ${input.unit}`);
  check(input.packSize > 0, `How much is in one pack of ${name}?`);
  check(Number.isInteger(input.packPriceCents) && input.packPriceCents > 0, `What does a pack of ${name} cost?`);
  check(input.shelfLifeDays > 0, `How long does ${name} stay fresh?`);
  check(db().prepare("SELECT 1 FROM suppliers WHERE id = ?").get(input.supplierId), `Unknown supplier ${input.supplierId}`);
  const existing = db().prepare("SELECT id FROM ingredients WHERE lower(name) = lower(?)").get(name);
  if (existing) return String(existing.id);

  const ingredientId = id("ing");
  const unitCost = input.packPriceCents / input.packSize;
  // Buy one pack at a time; reorder when there's a quarter pack, or ten treats' worth, left.
  const reorderPoint = Math.round(Math.max(input.packSize * 0.25, qtyPerUnit * 10) * 100) / 100;
  db()
    .prepare("INSERT INTO ingredients (id, name, unit, reorder_point, reorder_qty, unit_cost_cents, shelf_life_days, supplier_id) VALUES (?,?,?,?,?,?,?,?)")
    .run(ingredientId, name, input.unit, reorderPoint, input.packSize, unitCost, Math.round(input.shelfLifeDays), input.supplierId);
  db().prepare("INSERT INTO supplier_offers (ingredient_id, supplier_id, unit_cost_cents) VALUES (?,?,?)").run(ingredientId, input.supplierId, unitCost);
  return ingredientId;
}

export function addMenuItem(input: NewMenuItemInput): NewMenuItemResult {
  const name = input.name?.trim();
  check(name, "The treat needs a name");
  check(Number.isInteger(input.priceCents) && input.priceCents > 0, "The treat needs a price");
  check(input.ingredients?.length > 0, "Add at least one ingredient");
  check(
    !db().prepare("SELECT 1 FROM products WHERE active = 1 AND lower(name) = lower(?)").get(name),
    `${name} is already on the menu`,
  );

  const productId = id("prd");
  const created: { ingredientId: string; name: string }[] = [];
  tx(() => {
    db()
      .prepare("INSERT INTO products (id, name, emoji, price_cents, category, active) VALUES (?,?,?,?,?,1)")
      .run(productId, name, input.emoji || "🍰", input.priceCents, "other");
    const qtyById = new Map<string, number>();
    for (const line of input.ingredients) {
      check(line.qtyPerUnit > 0, "Each ingredient needs an amount");
      let ingredientId: string;
      if ("newIngredient" in line) {
        const before = db().prepare("SELECT COUNT(*) AS n FROM ingredients").get() as { n: number };
        ingredientId = createIngredient(line.newIngredient, line.qtyPerUnit);
        const after = db().prepare("SELECT COUNT(*) AS n FROM ingredients").get() as { n: number };
        if (after.n > before.n) created.push({ ingredientId, name: line.newIngredient.name.trim() });
      } else {
        check(db().prepare("SELECT 1 FROM ingredients WHERE id = ?").get(line.ingredientId), `Unknown ingredient ${line.ingredientId}`);
        ingredientId = line.ingredientId;
      }
      qtyById.set(ingredientId, (qtyById.get(ingredientId) ?? 0) + line.qtyPerUnit);
    }
    const insert = db().prepare("INSERT INTO recipe_items (product_id, ingredient_id, qty_per_unit) VALUES (?,?,?)");
    for (const [ingredientId, qty] of qtyById) insert.run(productId, ingredientId, qty);
  });

  // A brand-new ingredient has no stock: get an order ready. "manual" orders always wait for Grandma's yes.
  const orderedIngredients = created.map((c) => {
    try {
      return { ...c, reorderId: proposeReorder(c.ingredientId, "manual").id };
    } catch (err) {
      console.warn(`[catalog] couldn't propose a first order of ${c.name}`, err);
      return c;
    }
  });

  const item = listMenu().find((m) => m.id === productId);
  check(item, "The new treat didn't save");
  return { item, orderedIngredients };
}

/** Take a treat off the menu. Kept in the DB (inactive) so sales history still adds up. */
export function removeMenuItem(productId: string): { id: string; active: false } {
  const result = db().prepare("UPDATE products SET active = 0 WHERE id = ?").run(productId);
  check(result.changes > 0, `Unknown menu item ${productId}`);
  return { id: productId, active: false };
}
