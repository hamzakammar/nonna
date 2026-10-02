/**
 * LANE 2: THE VOICE. Notifications.
 * Spec: docs/roles/lane-2-voice.md
 *
 * Turns bus events into NonnaNotifications and decides when and where to deliver them.
 * The rush-aware queue is one of our differentiators: during a rush, only
 * "urgent" notifications are spoken. Everything else waits until it's quiet.
 */
import type { Channel, NonnaNotification, NotificationKind, Severity, VoiceAction } from "@/lib/types";
import { todo } from "@/lib/todo";

export interface NotifyInput {
  kind: NotificationKind;
  severity: Severity;
  text: string; // factual, built from real numbers
  awaitingAnswer?: { question: string; onYes: VoiceAction; onNo?: VoiceAction };
  channels?: Channel[]; // default: ["speaker", "dashboard"]
}

/** Persist, add persona phrasing (`spoken`), then deliver now or queue it until the rush ends. */
export function notify(input: NotifyInput): NonnaNotification {
  void input;
  return todo("lane2 notify");
}

/** For the SSE stream: subscribe to notifications as they're delivered. Returns an unsubscribe fn. */
export function subscribe(listener: (n: NonnaNotification) => void): () => void {
  void listener;
  return todo("lane2 subscribe");
}

export function acknowledge(notificationId: string): void {
  void notificationId;
  todo("lane2 acknowledge");
}

/**
 * Called once at boot. Map events to notifications:
 *  stock.low → (Lane 1 proposes a reorder) · reorder.proposed → yes/no question
 *  stock.expiring → nudge · stock.expired → info + waste $
 *  reorder.placed / reorder.received → info · rush.changed → hold or flush the queue
 *  insight.ready → gentle_truth (spoken only when it's quiet)
 */
export function registerNotifyListeners(): void {
  // TODO(lane2)
}
