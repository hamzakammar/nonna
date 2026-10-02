/**
 * Menu editing contract (GET/POST /api/menu, DELETE /api/menu/:id).
 * Kept out of `@/lib/types` so the shared contract doesn't change; promote it there if another lane needs it.
 * Safe to import from "use client" files: types only.
 */
import type { Product, Unit } from "@/lib/types";

export interface MenuItem extends Product {
  recipe: { ingredientId: string; name: string; unit: Unit; qtyPerUnit: number }[];
}

/** A brand-new ingredient Grandma describes while adding a treat. Everything else is derived from these. */
export interface NewIngredientInput {
  name: string;
  unit: Unit;
  supplierId: string;
  packSize: number; // base units in one pack she buys, e.g. 1000 (g)
  packPriceCents: number; // what that pack costs
  shelfLifeDays: number;
}

export interface NewMenuItemInput {
  name: string;
  emoji: string;
  priceCents: number;
  ingredients: ({ ingredientId: string; qtyPerUnit: number } | { newIngredient: NewIngredientInput; qtyPerUnit: number })[];
}

export interface NewMenuItemResult {
  item: MenuItem;
  /** Ingredients created with no stock yet. Each got a reorder proposed for Grandma to check. */
  orderedIngredients: { ingredientId: string; name: string; reorderId?: string }[];
}
