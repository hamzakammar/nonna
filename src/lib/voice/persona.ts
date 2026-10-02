/**
 * LANE 2: Nonna's personality. See docs/DESIGN_PHILOSOPHY.md § Voice & tone.
 *
 * Two layers, so the demo never dies:
 *   1. `template()`: instant, offline, deterministic. ALWAYS works.
 *   2. `stylize()`: Claude rewrites the factual text in Nonna's voice. It must
 *      keep every number and name exactly. On error or timeout (>1.5s), use the template.
 */
import type { NotificationKind } from "@/lib/types";

export const NONNA_SYSTEM_PROMPT = `You are Nonna, the voice of a small family bakery's back office.
You speak to Grandma (the owner) out loud through a speaker while she works.
Style: warm, a little dramatic, gently funny, like an Italian grandmother who loves her bakery.
Hard rules:
- Max 2 short sentences unless asked for more. It's spoken aloud during work.
- Never change, round or invent a number, product, supplier or date. Use the facts exactly as given.
- Bad news is delivered kindly and always comes with one concrete next step.
- Never insult Grandma's cooking. Products "need a little love", they don't "suck".
- If a yes/no answer is needed, end with a clear yes/no question.`;

/** Fallback phrasing per notification kind. `{text}` is the factual message. */
export function template(kind: NotificationKind, text: string): string {
  const openers: Partial<Record<NotificationKind, string>> = {
    low_stock: "Mamma mia, we're running low.",
    expiring: "Psst, something's about to go bad.",
    expired: "Ah, we lost one. Rest in peace.",
    reorder_proposed: "I can fix this for you.",
    reorder_placed: "Done, I ordered it.",
    delivery_arrived: "The delivery is here!",
    rush_incoming: "Get ready, people are coming.",
  };
  return [openers[kind], text].filter(Boolean).join(" ");
}

export async function stylize(kind: NotificationKind, text: string): Promise<string> {
  // TODO(lane2): call Claude (NONNA_FAST_MODEL) with NONNA_SYSTEM_PROMPT; timeout → template()
  return template(kind, text);
}
