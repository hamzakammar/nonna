// The frame every Granny screen sits in: one big "Home" button and a big title. Nothing else to learn.
import Link from "next/link";
import type { ReactNode } from "react";

export function GrannyPage({ title, emoji, children, home = true }: { title: string; emoji: string; children: ReactNode; home?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-5">
        {home && (
          <Link href="/kiosk" className="big-btn bg-white">
            <span aria-hidden>🏠</span> Home
          </Link>
        )}
        <h1 className="flex items-center gap-3 text-[44px] font-bold leading-tight">
          <span aria-hidden className="wiggle inline-block">{emoji}</span>
          {title}
        </h1>
      </header>
      {children}
    </main>
  );
}

/** Shown when another lane's piece isn't built yet (501), or something went wrong. Never a stack trace. */
export function StillCooking({ what, error }: { what: string; error?: boolean }) {
  return (
    <div className="toon flex items-center gap-5 p-6">
      <span aria-hidden className="wiggle text-6xl">{error ? "😳" : "🍳"}</span>
      <div>
        <div className="font-display text-[30px] font-bold">{error ? "Oops, I dropped the spoon" : "Still in the oven!"}</div>
        <div className="text-[22px] text-cocoa-soft">
          {error ? `I couldn't load ${what}. Try again in a moment.` : `${what} will be ready soon.`}
        </div>
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center gap-4 p-6 text-[28px] font-bold text-cocoa-soft">
      <span aria-hidden className="wiggle text-5xl">🥐</span> One moment, tesoro…
    </div>
  );
}

/** Falling sprinkles for a happy moment. */
export function Confetti() {
  const bits = ["🎉", "⭐", "🍰", "💛", "🧁", "✨", "🍂", "🥐"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 text-4xl"
          style={{
            left: `${(i * 37) % 100}%`,
            animation: `fall ${2.2 + ((i * 7) % 10) / 6}s ease-in ${((i * 3) % 10) / 10}s both`,
          }}
        >
          {bits[i % bits.length]}
        </span>
      ))}
    </div>
  );
}

/** A big "are you sure?" box. Two buttons, plain words. */
export function Confirm({
  emoji, question, yes, no, onYes, onNo, busy,
}: { emoji: string; question: string; yes: string; no: string; onYes: () => void; onNo: () => void; busy?: boolean }) {
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-40 flex items-center justify-center bg-cocoa/40 p-5">
      <div className="toon pop-in flex max-w-xl flex-col items-center gap-6 p-8 text-center">
        <span aria-hidden className="text-8xl">{emoji}</span>
        <p className="font-display text-[36px] font-bold leading-tight">{question}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <button className="big-btn bg-terracotta-deep text-white" onClick={onYes} disabled={busy}>{yes}</button>
          <button className="big-btn bg-white" onClick={onNo} disabled={busy} autoFocus>{no}</button>
        </div>
      </div>
    </div>
  );
}
