"use client";
// Nonna's voice on the kiosk home: her latest message as the headline, giant Yes / No when she asks
// something, and the mic. Lane 2 owns the ears (useNonnaEars) and the brains (/api/voice); this is only the look.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NonnaNotification, VoiceResponse } from "@/lib/types";
import { useNonnaEars } from "@/lib/voice/client/useNonnaEars";
import { Icon } from "./icons";

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
  const headline = question ?? message ?? idle;

  return (
    <header className="flex flex-col gap-4 pt-1.5">
      <div className="text-[20px] font-extrabold uppercase tracking-[0.14em] text-rust">Nonna&apos;s bakery</div>
      <h1 className={`m-0 max-w-[900px] leading-[1.08] [text-wrap:pretty] ${headline.length > 70 ? "text-[44px]" : "text-[58px]"}`}>{headline}</h1>

      {question && (
        <div className="pop-in flex gap-4 pt-1">
          <button className="big-btn btn-go px-12" disabled={busy} onClick={() => answer("yes")}>
            <Icon name="check" size={30} stroke={2.4} /> Yes
          </button>
          <button className="big-btn px-12" disabled={busy} onClick={() => answer("no")}>
            No
          </button>
        </div>
      )}

      {inBrowser && ears.supported && (
        <div className="flex items-center gap-4">
          <button
            className={`big-btn min-h-[60px] text-[22px] ${micOn ? "border-rust bg-tint-rust" : ""}`}
            onClick={() => setMicOn((on) => !on)}
          >
            <Icon name={micOn ? "ear" : "mic"} className="text-rust" /> {micOn ? "Nonna is listening" : "Talk to Nonna"}
          </button>
          {!micOn && (
            <button className="big-btn min-h-[60px] text-[22px]" disabled={busy} onClick={ears.listenOnce}>
              Tap &amp; talk
            </button>
          )}
          {micOn && <span className="text-[22px] font-bold text-ink-soft">Say &ldquo;Nonna&rdquo; and ask me anything</span>}
          {ears.lastHeard && <span className="text-[20px] font-semibold text-ink-soft">I heard: &ldquo;{ears.lastHeard}&rdquo;</span>}
        </div>
      )}
    </header>
  );
}
