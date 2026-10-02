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
import { todo } from "@/lib/todo";

const YES = /\b(yes|yeah|yep|sure|ok(ay)?|do it|go ahead|si|sì|please)\b/i;
const NO = /\b(no|nope|not now|later|don'?t|cancel|stop)\b/i;

export function quickYesNo(transcript: string): "yes" | "no" | null {
  if (YES.test(transcript)) return "yes";
  if (NO.test(transcript)) return "no";
  return null;
}

export async function handleUtterance(req: VoiceRequest): Promise<VoiceResponse> {
  void req;
  return todo("lane2 handleUtterance");
}
