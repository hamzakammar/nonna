"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNonnaEars } from "./useNonnaEars";
import { parseVoiceNavigation } from "./navigation";
import type { NonnaNotification, VoiceResponse } from "@/lib/types";

interface VoiceState {
  enabled: boolean;
  supported: boolean;
  listening: boolean;
  busy: boolean;
  lastHeard: string;
  message: string;
  pending: NonnaNotification | null;
  toggle: () => void;
  listenOnce: () => void;
  command: (transcript: string) => Promise<void>;
}

const VoiceContext = createContext<VoiceState | null>(null);

export function useVoiceController(): VoiceState {
  const context = useContext(VoiceContext);
  if (!context) throw new Error("VoiceController is missing");
  return context;
}

export function VoiceController({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Press Start, then say ‘Nonna’ and a task.");
  const [pending, setPending] = useState<NonnaNotification | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; notification?: NonnaNotification };
        if (data.type !== "notification" || !data.notification) return;
        setMessage(data.notification.text);
        if (data.notification.awaitingAnswer) setPending(data.notification);
      } catch { /* ignore malformed stream events */ }
    };
    return () => source.close();
  }, []);

  const command = useCallback(async (transcript: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const navigation = parseVoiceNavigation(transcript);
      if (navigation) {
        switch (navigation.type) {
          case "route":
            setMessage(`Opening ${navigation.label}.`);
            router.push(navigation.href);
            break;
          case "back": setMessage("Going back."); router.back(); break;
          case "forward": setMessage("Going forward."); router.forward(); break;
          case "top": setMessage("At the top."); window.scrollTo({ top: 0, behavior: "smooth" }); break;
          case "bottom": setMessage("At the bottom."); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); break;
          case "scroll_up": setMessage("Scrolling up."); window.scrollBy({ top: -window.innerHeight * 0.8, behavior: "smooth" }); break;
          case "scroll_down": setMessage("Scrolling down."); window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" }); break;
        }
        return;
      }
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
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [pending, router]);

  const ears = useNonnaEars({ enabled, expectingAnswer: pending !== null, onCommand: command });
  const toggle = useCallback(() => setEnabled((value) => !value), []);
  const state: VoiceState = { enabled, supported: ears.supported, listening: ears.listening, busy,
    lastHeard: ears.lastHeard, message, pending, toggle, listenOnce: ears.listenOnce, command };

  return <VoiceContext.Provider value={state}>
    {children}
    {pathname !== "/kiosk" && <aside aria-label="Voice controls" className="fixed bottom-4 right-4 z-50 max-w-xs rounded-2xl border border-stone-300 bg-amber-50 p-4 text-stone-900 shadow-lg">
      <p className="font-semibold">👵 Voice control</p>
      <p className="text-sm">{ears.supported ? enabled ? ears.listening ? "Listening" : "Starting microphone…" : "Microphone off" : "Use Chrome for voice control"}</p>
      <p className="mt-2 text-sm" aria-live="polite">{pending?.awaitingAnswer?.question ?? message}</p>
      {ears.lastHeard && <p className="mt-1 text-xs opacity-70">Heard: {ears.lastHeard}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={!ears.supported} onClick={toggle}>{enabled ? "Stop" : "Start voice"}</button>
        <button type="button" className="rounded-lg bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50" disabled={!ears.supported || busy} onClick={ears.listenOnce}>Tap & talk</button>
      </div>
      <p className="mt-2 text-xs opacity-70">Try “Nonna, open dashboard” or “Nonna, go back”.</p>
    </aside>}
  </VoiceContext.Provider>;
}
