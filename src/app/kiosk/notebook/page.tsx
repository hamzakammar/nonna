"use client";
// Nonna's Notebook: where the money went, in Nonna's handwriting. Every supplier is paid from its own
// card with a weekly limit (mock Ramp), and Nonna writes each charge in the margin. Data: GET /api/ramp/notebook (Lane 1).
import { useState } from "react";
import { Confirm, GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { money, DAY_NAMES, hourLabel } from "@/components/format";
import { send, useApi } from "@/components/useApi";

type Mood = "happy" | "proud" | "worried";

interface NotebookCard {
  id: string;
  displayName: string;
  lastFour: string;
  spendLimitCents: number;
  state: "ACTIVE" | "SUSPENDED" | "TERMINATED";
  weeklySpendCents: number;
  usedPct: number;
}

interface NotebookEntry {
  id: string;
  at: string;
  cardId: string;
  merchantName: string;
  amountCents: number;
  autopilot: boolean;
  line: string;
  mood: Mood;
}

interface Notebook {
  summary: { weekTotalCents: number; cards: NotebookCard[]; tightest?: NotebookCard };
  entries: NotebookEntry[];
  autopilot: { maxOrderCents: number; weeklyBudgetCents: number; spentCents: number; remainingCents: number };
}

/** "Thursday, 9 am" in the shop's local time. */
const when = (iso: string) => {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]}, ${hourLabel(d.getHours())}`;
};

const cardColor = (c: NotebookCard) =>
  c.state !== "ACTIVE" ? "bg-sky" : c.usedPct >= 80 ? "bg-berry text-white" : c.usedPct >= 50 ? "bg-butter-deep" : "bg-sage";

function Meter({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex flex-col gap-1">
      <div className="h-6 w-full overflow-hidden rounded-full border-4 border-cocoa bg-white" role="meter" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${clamped >= 80 ? "bg-berry" : clamped >= 50 ? "bg-butter-deep" : "bg-sage-deep"}`} style={{ width: `${clamped}%` }} />
      </div>
      <div className="text-[18px] font-bold">{label}</div>
    </div>
  );
}

export default function NotebookPage() {
  const book = useApi<Notebook>("/api/ramp/notebook", { pollMs: 5000 });
  const [freezing, setFreezing] = useState<NotebookCard | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleFreeze(card: NotebookCard) {
    setBusy(true);
    await send("/api/ramp/state", { body: { cardId: card.id, state: card.state === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } });
    setBusy(false);
    setFreezing(null);
    book.reload();
  }

  if (book.status === "loading") return <GrannyPage title="My notebook" emoji="📒"><Loading /></GrannyPage>;
  if (book.status !== "ok") {
    return <GrannyPage title="My notebook" emoji="📒"><StillCooking what="the notebook" error={book.status === "error"} /></GrannyPage>;
  }

  const { summary, entries, autopilot } = book.data;
  const tight = summary.tightest;
  const allowancePct = autopilot.weeklyBudgetCents ? (autopilot.spentCents / autopilot.weeklyBudgetCents) * 100 : 0;

  return (
    <GrannyPage title="My notebook" emoji="📒">
      <NonnaSays mood={tight && tight.usedPct >= 80 ? "worried" : "proud"}>
        This week we spent {money(summary.weekTotalCents)}.{" "}
        {tight && tight.usedPct >= 80
          ? `${tight.displayName.replace(/ card$/, "")} is at ${tight.usedPct}% of its limit. Eyes on it.`
          : "Every card is under its limit. Brava."}
      </NonnaSays>

      {/* Nonna's allowance: orders she places without asking */}
      <section className="toon flex flex-col gap-3 bg-butter p-6">
        <h2 className="font-display text-[30px] font-bold">🤖 My allowance</h2>
        <p className="text-[22px] font-semibold">
          Small, normal orders (up to {money(autopilot.maxOrderCents)}) I place myself. Anything bigger, I ask you first.
        </p>
        <Meter pct={allowancePct} label={`${money(autopilot.spentCents)} of ${money(autopilot.weeklyBudgetCents)} used this week`} />
      </section>

      {/* One card per supplier, each with its own weekly limit */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[32px] font-bold">💳 One card per supplier</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...summary.cards].sort((a, b) => b.usedPct - a.usedPct).map((c) => (
            <div key={c.id} className={`toon flex flex-col gap-2 p-4 ${cardColor(c)}`}>
              <div className="flex items-center justify-between gap-2">
                <span aria-hidden className="text-[28px]">{c.state === "ACTIVE" ? "💳" : "🧊"}</span>
                <span className="font-mono text-[16px] font-bold opacity-80">•••• {c.lastFour}</span>
              </div>
              <div className="font-display text-[22px] font-bold leading-tight">{c.displayName.replace(/ card$/, "")}</div>
              {c.state === "ACTIVE" ? (
                <Meter pct={c.usedPct} label={`${money(c.weeklySpendCents)} of ${money(c.spendLimitCents)} this week`} />
              ) : (
                <div className="text-[20px] font-bold">❄️ Frozen: no orders go through</div>
              )}
              <button
                className="self-start rounded-full border-4 border-cocoa bg-white px-4 py-1 text-[18px] font-bold text-cocoa shadow-[3px_3px_0_var(--cocoa)] transition-transform hover:-translate-y-0.5"
                onClick={() => setFreezing(c)}
              >
                {c.state === "ACTIVE" ? "❄️ Freeze card" : "🔥 Unfreeze"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* The ledger itself */}
      <section className="toon flex flex-col bg-white p-6">
        <h2 className="font-display mb-3 text-[32px] font-bold">✍️ Where the money went</h2>
        {entries.length === 0 ? (
          <p className="text-[24px]">Nothing yet. A quiet week, grazie a Dio.</p>
        ) : (
          <ol className="flex flex-col">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-4 border-b-2 border-dashed border-cocoa/30 py-4 last:border-b-0">
                <span aria-hidden className="text-[34px] leading-none">{e.amountCents < 0 ? "💚" : e.autopilot ? "🤖" : e.mood === "worried" ? "😬" : "🖊️"}</span>
                <div className="flex-1">
                  <div className="font-display text-[24px] font-semibold leading-snug">{e.line}</div>
                  <div className="text-[18px] text-cocoa-soft">{when(e.at)} · {e.merchantName}</div>
                </div>
                <div className={`font-display text-[26px] font-bold ${e.amountCents < 0 ? "text-sage-deep" : ""}`}>
                  {e.amountCents < 0 ? `+${money(-e.amountCents)}` : money(e.amountCents)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-center text-[16px] text-cocoa-soft">Supplier cards and limits: Ramp-style spend controls (demo data).</p>

      {freezing && (
        <Confirm
          emoji={freezing.state === "ACTIVE" ? "✂️" : "🔥"}
          question={
            freezing.state === "ACTIVE"
              ? `Freeze the ${freezing.displayName.replace(/ card$/, "")} card? No orders will go through until you unfreeze it.`
              : `Unfreeze the ${freezing.displayName.replace(/ card$/, "")} card?`
          }
          yes={freezing.state === "ACTIVE" ? "Yes, freeze it" : "Yes, unfreeze"}
          no="No, leave it"
          busy={busy}
          onYes={() => toggleFreeze(freezing)}
          onNo={() => setFreezing(null)}
        />
      )}
    </GrannyPage>
  );
}
