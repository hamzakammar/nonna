// Lane 2. Server-Sent Events: the kiosk and dashboard receive notifications live.
import { ensureBooted } from "@/lib/boot";
import { subscribe } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  ensureBooted();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      send({ type: "hello" });
      let unsubscribe = () => {};
      try {
        unsubscribe = subscribe((n) => send({ type: "notification", notification: n }));
      } catch {
        send({ type: "error", error: "notify.subscribe not implemented yet (lane2)" });
      }
      const ping = setInterval(() => send({ type: "ping" }), 15000);
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubscribe();
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
