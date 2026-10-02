/**
 * LANE 1: read a competitor's menu from a photo (their board, a flyer, or a
 * screenshot of their Uber Eats page) with Claude vision.
 *
 * Claude only reads what's printed and picks which of OUR products each item
 * matches (from a fixed list). It doesn't decide anything about our prices:
 * that's priceAdvice()'s job.
 * Server-only. Needs ANTHROPIC_API_KEY (or an `ant auth login` profile). Without
 * credentials it throws MenuReaderUnavailableError, and the demo uses the mock feed instead.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import type { IncomingPrice } from "./index";

const MODEL = process.env.NONNA_VISION_MODEL ?? "claude-opus-5";

export const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type MenuMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export class MenuReaderUnavailableError extends Error {}

/**
 * Is any Anthropic credential source configured? With none, the SDK throws a plain Error
 * at request time (no typed class to catch), so check up front for a clean 503.
 */
function hasCredentials(): boolean {
  const env = process.env;
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE || env.ANTHROPIC_IDENTITY_TOKEN || env.ANTHROPIC_IDENTITY_TOKEN_FILE) return true;
  return existsSync(path.join(os.homedir(), ".config", "anthropic")); // `ant auth login` profiles
}

const SYSTEM = `You read photos of bakery and café menus for a small family bakery that wants to compare prices.
Extract every item that has a clearly visible price. Rules:
- item_name: exactly as written on the menu.
- price_cents: the price in cents as an integer (e.g. $7.25 → 725). If an item lists several sizes, use the smallest/regular size.
- Skip anything whose price you can't read clearly. Never guess a price.
- matches_product_id: the id of OUR product that is the same kind of item (a pumpkin parfait matches our Fall Parfait, an apple slice or apple pie matches our Apple Pie), or null if nothing on our menu is comparable.`;

export async function readMenuPhoto(image: { base64: string; mediaType: MenuMediaType }): Promise<IncomingPrice[]> {
  const products = db().prepare("SELECT id, name FROM products WHERE active = 1 ORDER BY id").all() as { id: string; name: string }[];
  const ids = products.map((p) => p.id) as [string, ...string[]];
  const MenuSchema = z.object({
    items: z.array(
      z.object({
        item_name: z.string(),
        price_cents: z.number().int(),
        matches_product_id: z.enum(ids).nullable(),
      }),
    ),
  });

  if (!hasCredentials()) throw new MenuReaderUnavailableError("Reading menu photos needs ANTHROPIC_API_KEY in .env.local");
  const client = new Anthropic();

  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, Anthropic re-runs it on a fallback model server-side.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(MenuSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
            {
              type: "text",
              text: `Our products (id: name):\n${products.map((p) => `${p.id}: ${p.name}`).join("\n")}\n\nExtract the menu items and prices from this photo.`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new MenuReaderUnavailableError("Reading menu photos needs a valid ANTHROPIC_API_KEY in .env.local");
    }
    throw err;
  }

  if (response.stop_reason === "refusal") throw new Error("Claude declined to read this image");
  if (response.stop_reason === "max_tokens") throw new Error("Menu too long to read in one photo, so try a closer crop");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Couldn't read a menu from this photo");

  return parsed.items
    .filter((i) => i.price_cents > 0 && i.item_name.trim())
    .map((i) => ({ itemName: i.item_name.trim(), priceCents: i.price_cents, productId: i.matches_product_id }));
}
