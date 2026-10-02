"use client";

import { useVoiceController } from "./VoiceController";

/** Kiosk view of the voice session shared across every page. */
export function NonnaListener() {
  const voice = useVoiceController();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-amber-50 p-8 text-center text-stone-900">
      <div className="text-8xl" aria-hidden="true">👵</div>
      <h1 className="text-5xl font-bold">Nonna is listening</h1>
      <p className="text-2xl">{voice.supported ? voice.enabled ? voice.listening ? "Listening" : "Starting microphone…" : "Microphone is off" : "Speech recognition needs Chrome"}</p>
      <p className="max-w-3xl text-3xl" aria-live="polite">{voice.pending?.awaitingAnswer?.question ?? voice.message}</p>
      {voice.lastHeard && <p className="text-xl opacity-70">Heard: {voice.lastHeard}</p>}
      <div className="flex flex-wrap justify-center gap-4">
        <button type="button" className="rounded-2xl bg-stone-900 px-8 py-5 text-2xl text-white disabled:opacity-50" disabled={!voice.supported} onClick={voice.toggle}>
          {voice.enabled ? "Stop listening" : "Start listening"}
        </button>
        <button type="button" className="rounded-2xl bg-amber-700 px-8 py-5 text-2xl text-white disabled:opacity-50" disabled={!voice.supported || voice.busy} onClick={voice.listenOnce}>Tap & talk</button>
      </div>
      {voice.pending && <div className="flex gap-4">
        <button type="button" className="rounded-2xl bg-green-700 px-10 py-5 text-2xl text-white" onClick={() => voice.command("yes")}>Yes</button>
        <button type="button" className="rounded-2xl bg-red-700 px-10 py-5 text-2xl text-white" onClick={() => voice.command("no")}>No</button>
      </div>}
      <p className="text-lg opacity-70">Say “Nonna, open dashboard” to move around the site.</p>
    </main>
  );
}
