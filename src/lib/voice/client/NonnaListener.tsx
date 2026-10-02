"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNonnaEars } from "./useNonnaEars";
import type { NonnaNotification, VoiceResponse } from "@/lib/types";

/** Audio input only. Results and questions appear as text; no speech is generated. */
export function NonnaListener() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Press Start, then say ‘Nonna’ and a task.");
  const [pending, setPending] = useState<NonnaNotification | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; notification?: NonnaNotification };
      if (data.type !== "notification" || !data.notification) return;
      setMessage(data.notification.text);
      if (data.notification.awaitingAnswer) setPending(data.notification);
    };
    return () => source.close();
  }, []);

  const onCommand = useCallback(async (transcript: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, pendingNotificationId: pending?.id }),
      });
      const result = await response.json() as VoiceResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Request failed");
      setMessage(result.spoken);
      if (result.intent === "approve" || result.intent === "decline") setPending(null);
    } catch {
      setMessage("I couldn't complete that task. Please try again.");
    } finally { inFlight.current = false; setBusy(false); }
  }, [pending]);

  const ears = useNonnaEars({ enabled, expectingAnswer: pending !== null, onCommand });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-amber-50 p-8 text-center text-stone-900">
      <div className="text-8xl" aria-hidden="true">👵</div>
      <h1 className="text-5xl font-bold">Nonna is listening</h1>
      <p className="text-2xl">{ears.supported ? enabled ? ears.listening ? "Listening" : "Starting microphone…" : "Microphone is off" : "Speech recognition needs Chrome"}</p>
      <p className="max-w-3xl text-3xl">{pending?.awaitingAnswer?.question ?? message}</p>
      {ears.lastHeard && <p className="text-xl opacity-70">Heard: {ears.lastHeard}</p>}
      <div className="flex flex-wrap justify-center gap-4">
        <button className="rounded-2xl bg-stone-900 px-8 py-5 text-2xl text-white disabled:opacity-50" disabled={!ears.supported} onClick={() => setEnabled((value) => !value)}>
          {enabled ? "Stop listening" : "Start listening"}
        </button>
        <button className="rounded-2xl bg-amber-700 px-8 py-5 text-2xl text-white disabled:opacity-50" disabled={!ears.supported || busy} onClick={ears.listenOnce}>Tap & talk</button>
      </div>
      {pending && <div className="flex gap-4">
        <button className="rounded-2xl bg-green-700 px-10 py-5 text-2xl text-white" onClick={() => onCommand("yes")}>Yes</button>
        <button className="rounded-2xl bg-red-700 px-10 py-5 text-2xl text-white" onClick={() => onCommand("no")}>No</button>
      </div>}
    </main>
  );
}
