import { handle } from "@/lib/api";
import { notify } from "@/lib/notify";

/** Temporary smoke test: POST while /api/notifications/stream is open. */
export async function POST() {
  return handle(() => notify({ kind: "low_stock", severity: "nudge", text: "Cream is running low. Check the pantry." }));
}
