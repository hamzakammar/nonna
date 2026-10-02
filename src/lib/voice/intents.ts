/**
 * LANE 2: understands what Grandma said and does it.
 *
 * Flow: transcript → (fast path: yes/no regex when a question is pending)
 *                  → else Claude tool use with a SMALL tool set:
 *                      get_inventory, get_sales_summary, get_rush_status,
 *                      approve_reorder, cancel_reorder, order_now, mark_received,
 *                      log_waste, snooze
 *       → execute via Lane 1/3 public APIs → phrase the result with persona → VoiceResponse
 *
 * The LLM chooses WHICH tool to call. Tool RESULTS come from our code.
 * Spoken numbers come from tool results, never from the model's imagination.
 */
import type { VoiceRequest, VoiceResponse } from "@/lib/types";
import { approveReorder, cancelReorder, receiveReorder, proposeReorder } from "@/lib/inventory";
import { acknowledge, getNotification } from "@/lib/notify";
import { db, id } from "@/lib/db";
import { nowIso } from "@/lib/clock";
import type { VoiceAction } from "@/lib/types";

const YES = /\b(yes|yeah|yep|sure|ok(ay)?|do it|go ahead|si|sì|please)\b/i;
const NO = /\b(no|nope|not now|later|don'?t|cancel|stop)\b/i;

export function quickYesNo(transcript: string): "yes" | "no" | null {
  if (YES.test(transcript)) return "yes";
  if (NO.test(transcript)) return "no";
  return null;
}

export async function handleUtterance(req: VoiceRequest): Promise<VoiceResponse> {
  const pending = req.pendingNotificationId ? getNotification(req.pendingNotificationId) : undefined;
  const answer = quickYesNo(req.transcript);
  let response: VoiceResponse;
  if (pending?.awaitingAnswer && !pending.acknowledgedAt && answer) {
    const action = answer === "yes" ? pending.awaitingAnswer.onYes : pending.awaitingAnswer.onNo ?? { type: "none" };
    try {
      execute(action);
      acknowledge(pending.id);
      response = { spoken: answer === "yes" ? "Okay, tesoro. It's taken care of." : "Okay, I'll leave it for now.", action, intent: answer === "yes" ? "approve" : "decline" };
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Not implemented yet")) throw error;
      response = { spoken: "That action is still cooking. Please try again later.", action: { type: "none" }, intent: "unavailable" };
    }
  } else {
    response = { spoken: "Sorry tesoro, say that again?", action: { type: "none" }, intent: "unknown" };
  }
  db().prepare("INSERT INTO voice_log (id, at, transcript, intent, spoken) VALUES (?, ?, ?, ?, ?)")
    .run(id("voice"), nowIso(), req.transcript, response.intent, response.spoken);
  return response;
}

function execute(action: VoiceAction): void {
  switch (action.type) {
    case "approve_reorder": approveReorder(action.reorderId); break;
    case "cancel_reorder": cancelReorder(action.reorderId); break;
    case "mark_received": receiveReorder(action.reorderId); break;
    case "order_now": proposeReorder(action.ingredientId, "manual", action.qty); break;
    case "snooze": case "none": break;
    case "log_waste": throw new Error("Not implemented yet: lane1 log_waste");
  }
}
