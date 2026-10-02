// The frame every Granny screen sits in: a Home pill and a big serif title. Nothing else to learn.
// Sized for the demo laptop: one centred 1194px column, like the designs in design/.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export function GrannyPage({ title, children, home = true, action }: { title: string; emoji?: string; children: ReactNode; home?: boolean; action?: ReactNode }) {
  return (
    <main className="mx-auto flex w-[1194px] max-w-full flex-1 flex-col gap-7 px-14 pb-11 pt-8">
      <header className="flex items-center gap-[22px]">
        {home && (
          <Link href="/kiosk" className="big-btn min-h-[64px] border-linen text-[26px]">
            <Icon name="home" className="text-rust" /> Home
          </Link>
        )}
        <h1 className="m-0 flex-1 text-[50px] leading-[1.05]">{title}</h1>
        {action}
      </header>
      {children}
    </main>
  );
}

/** Shown when another lane's piece isn't built yet (501), or something went wrong. Never a stack trace. */
export function StillCooking({ what, error }: { what: string; error?: boolean }) {
  return (
    <div className="flex items-center gap-5 rounded-[18px] border-[1.5px] border-linen bg-paper px-6 py-5">
      <span className="icon-dot h-16 w-16 bg-tint-gold text-ochre"><Icon name={error ? "x" : "clock"} size={34} /></span>
      <div>
        <div className="font-display text-[28px]">{error ? "Oops, I dropped the spoon" : "Still in the oven"}</div>
        <div className="text-[22px] font-semibold text-ink-soft">
          {error ? `I couldn't load ${what}. Try again in a moment.` : `${what} will be ready soon.`}
        </div>
      </div>
    </div>
  );
}

export function Loading() {
  return <div className="p-6 text-[26px] font-bold text-ink-soft">One moment, tesoro…</div>;
}

/** Falling autumn leaves for a happy moment. */
export function Confetti() {
  const colors = ["#a94f1d", "#e3b04b", "#c8642c", "#4c5a2c", "#8a3324"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 26 }, (_, i) => (
        <svg
          key={i}
          width={28 + (i % 3) * 10}
          height={28 + (i % 3) * 10}
          viewBox="0 0 24 24"
          className="absolute top-0"
          style={{ left: `${(i * 37) % 100}%`, animation: `fall ${2.4 + ((i * 7) % 10) / 6}s ease-in ${((i * 3) % 10) / 10}s both` }}
        >
          <path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" fill={colors[i % colors.length]} />
        </svg>
      ))}
    </div>
  );
}

/** A big "are you sure?" box. Two buttons, plain words. */
export function Confirm({
  question, yes, no, onYes, onNo, busy,
}: { emoji?: string; question: string; yes: string; no: string; onYes: () => void; onNo: () => void; busy?: boolean }) {
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-5">
      <div className="toon pop-in flex w-[640px] flex-col items-center gap-7 px-10 py-9 text-center">
        <p className="font-display m-0 text-[38px] leading-tight">{question}</p>
        <div className="flex gap-4">
          <button className="big-btn btn-primary" onClick={onYes} disabled={busy}>{yes}</button>
          <button className="big-btn" onClick={onNo} disabled={busy} autoFocus>{no}</button>
        </div>
      </div>
    </div>
  );
}
