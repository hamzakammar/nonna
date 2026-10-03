"use client";
// Nonna on the kiosk home: her latest message as the headline, and giant Yes / No when she asks
// something. Touch only (no mic). Answers still go through Lane 2's /api/voice; this is only the look.
import { useCallback, useEffect, useRef, useState } from "react";
import type { NonnaNotification, VoiceResponse } from "@/lib/types";
import { Icon } from "./icons";

export function NonnaVoice({ idle, onChange }: { idle: string; onChange?: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<NonnaNotification | null>(null);
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
    </header>
  );
}
