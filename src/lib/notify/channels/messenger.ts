/**
 * LANE 2 (P1): Facebook Messenger channel. Sends a notification to Grandma's phone.
 *
 * Setup notes (also in docs/roles/lane-2-voice.md):
 *  - Needs a Facebook Page + Meta app (dev mode is fine). Grandma's account must
 *    have a role on the app, or have messaged the Page first.
 *  - Messages outside the 24h window need a message tag. For the demo, have her
 *    message the Page first.
 *  - Env: MESSENGER_PAGE_TOKEN, MESSENGER_RECIPIENT_PSID
 * If env vars are missing: console.log and return. Never throw. The speaker is the primary channel.
 */
import type { NonnaNotification } from "@/lib/types";

export async function sendMessenger(n: NonnaNotification): Promise<void> {
  if (!process.env.MESSENGER_PAGE_TOKEN || !process.env.MESSENGER_RECIPIENT_PSID) {
    console.log(`[messenger:mock] → Nonna: ${n.spoken ?? n.text}`);
    return;
  }
  // TODO(lane2): POST https://graph.facebook.com/v21.0/me/messages
}
