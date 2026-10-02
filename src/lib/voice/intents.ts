/** Deterministic, offline commands. All facts and side effects come from lane APIs. */
import { approveReorder, cancelReorder, listInventory, listReorders, logWaste, orderNow, raiseCardLimit, receiveReorder } from "@/lib/inventory";
import { gentleTruths, productPerformance, rushStatus } from "@/lib/analytics";
import { acknowledge, getNotification } from "@/lib/notify";
import { db, id } from "@/lib/db";
import { nowIso } from "@/lib/clock";
import type { IngredientStatus, Reorder, VoiceAction, VoiceRequest, VoiceResponse } from "@/lib/types";

const YES = /\b(yes|yeah|yep|sure|okay|ok|do it|go ahead|si|sì)\b/i;
const NO = /\b(no|nope|not now|later|don'?t|cancel|stop)\b/i;
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function quickYesNo(transcript: string): "yes" | "no" | null {
  if (NO.test(transcript)) return "no";
  if (YES.test(transcript)) return "yes";
  return null;
}

function reply(spoken: string, intent: string, action: VoiceAction = { type: "none" }): VoiceResponse {
  return { spoken, intent, action };
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findIngredient(words: string, stock: IngredientStatus[]): IngredientStatus | undefined {
  const clean = ` ${norm(words)} `;
  const matches = stock.filter(({ ingredient }) => {
    const name = norm(ingredient.name);
    return clean.includes(` ${name} `) || (name.includes(" ") && clean.includes(` ${name.split(" ").at(-1)} `));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function findReorder(words: string, orders: Reorder[], stock: IngredientStatus[]): Reorder | undefined {
  const item = findIngredient(words, stock);
  if (item) return orders.find((order) => order.ingredientId === item.ingredient.id);
  return orders.length === 1 ? orders[0] : undefined;
}

function quantity(words: string, unit: IngredientStatus["ingredient"]["unit"]): number | undefined {
  const match = /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s*(litres?|liters?|l\b|kilograms?|kilos?|kg\b|grams?|g\b|millilitres?|milliliters?|ml\b|pieces?|pcs\b)?/i.exec(words);
  if (!match) return undefined;
  const value = WORD_NUMBERS[match[1].toLowerCase()] ?? Number(match[1]);
  const spokenUnit = (match[2] ?? "").toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (spokenUnit.startsWith("lit") || spokenUnit === "l") return unit === "ml" ? value * 1000 : undefined;
  if (spokenUnit.startsWith("kil") || spokenUnit === "kg") return unit === "g" ? value * 1000 : undefined;
  if ((spokenUnit === "g" || spokenUnit.startsWith("gram")) && unit !== "g") return undefined;
  if ((spokenUnit === "ml" || spokenUnit.startsWith("mill")) && unit !== "ml") return undefined;
  if ((spokenUnit.startsWith("piec") || spokenUnit === "pcs") && unit !== "pcs") return undefined;
  return value;
}

function dollars(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

function runPending(req: VoiceRequest): VoiceResponse | undefined {
  const pending = req.pendingNotificationId ? getNotification(req.pendingNotificationId) : undefined;
  const answer = quickYesNo(req.transcript);
  if (!pending?.awaitingAnswer || pending.acknowledgedAt || !answer) return undefined;
  const action = answer === "yes" ? pending.awaitingAnswer.onYes : pending.awaitingAnswer.onNo ?? { type: "none" };
  let message = answer === "yes" ? "Okay, done." : "Okay, I won't do that.";
  switch (action.type) {
    case "approve_reorder": { const order = approveReorder(action.reorderId); message = `Ordered ${order.qty} units for ${dollars(order.costCents)}.`; break; }
    case "cancel_reorder": cancelReorder(action.reorderId); message = "Order cancelled."; break;
    case "mark_received": receiveReorder(action.reorderId); message = "Delivery received."; break;
    case "order_now": { const order = orderNow(action.ingredientId, action.qty); message = `Ordered ${order.qty} units for ${dollars(order.costCents)}.`; break; }
    case "log_waste": logWaste(action.ingredientId, action.qty); message = "Waste recorded."; break;
    case "raise_card_limit": raiseCardLimit(action.cardId, action.newLimitCents, action.thenApproveReorderId); message = `Card limit raised to ${dollars(action.newLimitCents)}.`; break;
    case "snooze": message = "I'll leave it for now."; break;
    case "none": break;
  }
  acknowledge(pending.id);
  return reply(message, answer === "yes" ? "approve" : "decline", action);
}

function runCommand(transcript: string): VoiceResponse {
  const words = transcript.replace(/^\s*(?:nonna|nona|nana|nonnah)\b[,\s]*/i, "").trim();
  if (!words) return reply("Tell me what you need.", "empty");
  const stock = listInventory();
  const item = findIngredient(words, stock);
  const clean = norm(words);
  const orders = listReorders().filter((order) => order.status === "proposed" || order.status === "placed");

  if (/\b(cancel|undo|don t want)\b/.test(clean)) {
    const order = findReorder(words, orders, stock);
    if (!order) return reply("Which open order should I cancel?", "clarify_order");
    cancelReorder(order.id);
    return reply("Order cancelled.", "cancel_reorder", { type: "cancel_reorder", reorderId: order.id });
  }
  if (/\b(received|arrived|delivery is here|mark delivered)\b/.test(clean)) {
    const order = findReorder(words, orders.filter((o) => o.status === "placed"), stock);
    if (!order) return reply("Which delivery arrived?", "clarify_delivery");
    receiveReorder(order.id);
    return reply("Delivery received.", "mark_received", { type: "mark_received", reorderId: order.id });
  }
  if (/\b(dropped|spilled|spoiled|wasted|throw away|tossed)\b/.test(clean)) {
    if (!item) return reply("Which ingredient was wasted?", "clarify_ingredient");
    const qty = quantity(words, item.ingredient.unit);
    if (!qty) return reply(`How much ${item.ingredient.name} was wasted?`, "clarify_quantity");
    const events = logWaste(item.ingredient.id, qty, /spoiled/.test(clean) ? "spoiled" : "dropped");
    const logged = events.reduce((total, event) => total + event.qty, 0);
    return reply(`Recorded ${logged} ${item.ingredient.unit} of ${item.ingredient.name} as waste.`, "log_waste", { type: "log_waste", ingredientId: item.ingredient.id, qty: logged });
  }
  if (/\b(order|buy|restock|get more|we need)\b/.test(clean) && !/\b(did|when|why|what|how|should)\b/.test(clean)) {
    if (!item) return reply("Which ingredient should I order?", "clarify_ingredient");
    const qty = quantity(words, item.ingredient.unit);
    const order = orderNow(item.ingredient.id, qty);
    return reply(`Ordered ${order.qty} ${item.ingredient.unit} of ${item.ingredient.name} for ${dollars(order.costCents)}.`, "order_now", { type: "order_now", ingredientId: item.ingredient.id, qty });
  }
  if (/\b(stock|left|have|much|running low|how s|how is)\b/.test(clean) && item) {
    return reply(`${item.ingredient.name}: ${item.totalQty} ${item.ingredient.unit} left; stock is ${item.level}.`, "ask_stock");
  }
  if (/\b(orders?|reorders?|deliveries)\b/.test(clean)) {
    return reply(orders.length ? `${orders.length} open orders: ${orders.map((order) => `${stock.find((s) => s.ingredient.id === order.ingredientId)?.ingredient.name ?? order.ingredientId} ${order.status}`).join(", ")}.` : "There are no open orders.", "ask_orders");
  }
  if (/\b(selling|seller|sales|popular|best)\b/.test(clean)) {
    const best = productPerformance(7).find((product) => product.unitsSold > 0);
    return reply(best ? `${best.name} sold best this week: ${best.unitsSold} sold, ${dollars(best.revenueCents)} in sales.` : "There are no sales recorded this week.", "ask_sales");
  }
  if (/\b(busy|rush|quiet)\b/.test(clean)) {
    const rush = rushStatus();
    return reply(`The bakery is ${rush.label} right now.`, "ask_rush");
  }
  if (/\b(doing|performance|truth|how s|how is)\b/.test(clean)) {
    const truths = gentleTruths();
    const match = truths.find((truth) => {
      const name = norm(truth.facts.split(":")[0]).replace(/\b(slice|whole)\b/g, "").trim();
      return clean.includes(norm(truth.productId)) || clean.includes(name);
    });
    if (match) return reply(`${match.facts} ${match.suggestion}`, "ask_product");
  }
  return reply("I didn't catch a task I can do. Try asking about stock, sales, or an order.", "unknown");
}

export async function handleUtterance(req: VoiceRequest): Promise<VoiceResponse> {
  const transcript = typeof req.transcript === "string" ? req.transcript.trim() : "";
  if (!transcript) return reply("Tell me what you need.", "empty");
  let response: VoiceResponse;
  try { response = runPending({ ...req, transcript }) ?? runCommand(transcript); }
  catch (error) {
    console.error("[voice] command failed", error);
    response = reply("I couldn't complete that task. Please check the dashboard.", "error");
  }
  db().prepare("INSERT INTO voice_log (id, at, transcript, intent, spoken) VALUES (?, ?, ?, ?, ?)")
    .run(id("voice"), nowIso(), transcript, response.intent, response.spoken);
  return response;
}
