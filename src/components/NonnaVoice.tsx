"use client";
// Nonna's voice on the kiosk: her latest message, giant YES / NO when she asks something, and the mic.
// Lane 2 owns the ears (useNonnaEars) and the brains (/api/voice); this is only the look.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NonnaNotification, VoiceResponse } from "@/lib/types";
import { useNonnaEars } from "@/lib/voice/client/useNonnaEars";
import { NonnaSays } from "./Nonna";

const noop = () => () => {};

export function NonnaVoice({ idle, onChange }: { idle: string; onChange?: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<NonnaNotification | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; notification?: NonnaNotification };
      if (data.type !== "notification" || !data.notification) return;
      setMessage(data.notification.spoken ?? data.notification.text);
      if (data.notification.awaitingAnswer) setPending(data.notification);
      onChange?.();
    };
    return () => source.close();
  }, [onChange]);

  const answer = useCallback(
    async (transcript: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, pendingNotificationId: pending?.id }),
        });
        const result = (await res.json()) as VoiceResponse & { error?: string };
        if (!res.ok) throw new Error(result.error);
        setMessage(result.spoken);
        if (result.intent === "approve" || result.intent === "decline") setPending(null);
        onChange?.();
      } catch {
        setMessage("Sorry tesoro, I didn't catch that. Try again?");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [pending, onChange],
  );

  // The server can't know if the browser has speech recognition: only show the mic once we're in the browser.
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  const ears = useNonnaEars({ enabled: micOn, expectingAnswer: pending !== null, onCommand: answer });
  const question = pending?.awaitingAnswer?.question;

  return (
    <section className="flex flex-col gap-5">
      <NonnaSays size={150} mood={question ? "happy" : "proud"}>
        {question ?? message ?? idle}
      </NonnaSays>

      {question && (
        <div className="pop-in flex flex-wrap gap-5 sm:pl-[170px]">
          <button className="big-btn bg-sage px-12 text-[36px]" disabled={busy} onClick={() => answer("yes")}>
            <span aria-hidden>👍</span> Yes
          </button>
          <button className="big-btn bg-white px-12 text-[36px]" disabled={busy} onClick={() => answer("no")}>
            <span aria-hidden>✋</span> No
          </button>
        </div>
      )}

      {inBrowser && ears.supported && (
        <div className="flex flex-wrap items-center gap-4 sm:pl-[170px]">
          <button className={`big-btn min-h-[64px] text-[24px] ${micOn ? "bg-berry text-white" : "bg-white"}`} onClick={() => setMicOn((on) => !on)}>
            <span aria-hidden>{micOn ? "👂" : "🎤"}</span> {micOn ? "Nonna is listening" : "Talk to Nonna"}
          </button>
          {!micOn && (
            <button className="big-btn min-h-[64px] bg-white text-[24px]" disabled={busy} onClick={ears.listenOnce}>
              <span aria-hidden>🗣️</span> Tap &amp; talk
            </button>
          )}
          {micOn && <span className="text-[22px] font-bold">Say &ldquo;Nonna&rdquo; and ask me anything</span>}
          {ears.lastHeard && <span className="text-[20px] text-cocoa-soft">I heard: &ldquo;{ears.lastHeard}&rdquo;</span>}
        </div>
      )}
    </section>
  );
}
