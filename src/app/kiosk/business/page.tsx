"use client";
// Lane 4. "How's the shop?": best sellers, busy times, and the Gentle Truth. All numbers come from Lane 3.
import type { BusynessBucket, GentleTruth, ProductPerformance, RushStatus } from "@/lib/types";
import type { MenuItem } from "@/lib/catalog/types";
import { DAY_NAMES, hourLabel, money } from "@/components/format";
import { GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaFace } from "@/components/Nonna";
import { SAMPLE_BUSYNESS, SAMPLE_PRODUCTS, SAMPLE_RUSH, SAMPLE_TRUTHS } from "@/components/sampleData";
import { useApi, type ApiState } from "@/components/useApi";

const MEDALS = ["🥇", "🥈", "🥉"];
const TREND = { rising: { emoji: "📈", word: "going up" }, steady: { emoji: "➡️", word: "steady" }, falling: { emoji: "📉", word: "going down" } };
const RUSH = {
  quiet: { emoji: "😌", word: "Nice and quiet" },
  steady: { emoji: "🙂", word: "A steady trickle" },
  busy: { emoji: "😅", word: "Getting busy" },
  rush: { emoji: "🔥", word: "It's a rush!" },
};
// level 0 (dead) → 4 (slammed)
const HEAT = ["#fffaf0", "#ffe9a8", "#ffcf6b", "#f4a261", "#e07a5f"];
const OPEN_HOURS = Array.from({ length: 11 }, (_, i) => 7 + i); // 7am–5pm
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first

function Panel({ title, emoji, sample, children }: { title: string; emoji: string; sample?: boolean; children: React.ReactNode }) {
  return (
    <section className="toon flex flex-col gap-5 p-6 sm:p-8">
      <h2 className="flex flex-wrap items-center gap-3 text-[36px] font-bold">
        <span aria-hidden>{emoji}</span>{title}
        {sample && <span className="rounded-full border-[3px] border-cocoa bg-white px-3 py-0.5 text-[16px] font-bold" title="The real numbers aren't connected yet">🧪 Sample numbers</span>}
      </h2>
      {children}
    </section>
  );
}

function Gate<T>({ state, what, children }: { state: ApiState<T>; what: string; children: (data: T) => React.ReactNode }) {
  if (state.status === "loading") return <Loading />;
  if (state.status !== "ok") return <StillCooking what={what} error={state.status === "error"} />;
  return <>{children(state.data)}</>;
}

export default function Business() {
  const products = useApi<ProductPerformance[]>("/api/analytics/products?days=7", { sample: SAMPLE_PRODUCTS });
  const busyness = useApi<BusynessBucket[]>("/api/analytics/busyness?days=28", { sample: SAMPLE_BUSYNESS });
  const rush = useApi<RushStatus>("/api/analytics/rush", { pollMs: 10000, sample: SAMPLE_RUSH });
  const truths = useApi<GentleTruth[]>("/api/analytics/truths?days=14", { sample: SAMPLE_TRUTHS });
  const menu = useApi<MenuItem[]>("/api/menu");
  const emojiOf = (productId: string) => (menu.status === "ok" ? menu.data.find((m) => m.id === productId)?.emoji : undefined) ?? "🍰";
  const nameOf = (productId: string) =>
    (products.status === "ok" ? products.data.find((p) => p.productId === productId)?.name : undefined) ??
    (menu.status === "ok" ? menu.data.find((m) => m.id === productId)?.name : undefined) ??
    "A treat";

  return (
    <GrannyPage title="How's the shop?" emoji="📊">
      <Panel title="Best sellers this week" emoji="⭐" sample={products.isSample}>
        <Gate state={products} what="Your best sellers">
          {(rows) => {
            const ranked = [...rows].sort((a, b) => a.rank - b.rank);
            const top = ranked.slice(0, 3);
            const most = Math.max(1, ...ranked.map((r) => r.unitsSold));
            if (ranked.length === 0) return <p className="text-[24px]">No sales yet this week.</p>;
            return (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  {top.map((p, i) => (
                    <div key={p.productId} className="flex flex-col items-center gap-1 rounded-3xl border-4 border-cocoa bg-butter p-5 text-center">
                      <span className="text-5xl">{MEDALS[i]}</span>
                      <span className="text-[70px] leading-none">{emojiOf(p.productId)}</span>
                      <span className="font-display text-[28px] font-bold leading-tight">{p.name}</span>
                      <span className="text-[24px] font-bold">{p.unitsSold} sold</span>
                    </div>
                  ))}
                </div>
                <ul className="flex flex-col gap-3">
                  {ranked.map((p) => (
                    <li key={p.productId} className="grid grid-cols-[3rem_minmax(8rem,14rem)_1fr] items-center gap-3 text-[22px] font-bold">
                      <span className="text-4xl">{emojiOf(p.productId)}</span>
                      <span className="truncate">{p.name}</span>
                      <span className="flex items-center gap-3">
                        <span className="h-8 rounded-full border-[3px] border-cocoa bg-sage" style={{ width: `${Math.max(4, (p.unitsSold / most) * 100)}%` }} />
                        <span className="whitespace-nowrap">{p.unitsSold} <span title={TREND[p.trend].word}>{TREND[p.trend].emoji}</span></span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[20px] text-cocoa-soft">
                  Money in this week: {money(ranked.reduce((s, p) => s + p.revenueCents, 0))}
                </p>
              </>
            );
          }}
        </Gate>
      </Panel>

      <Panel title="When it gets busy" emoji="⏰" sample={busyness.isSample}>
        {rush.status === "ok" && (
          <div className="flex items-center gap-4 rounded-3xl border-4 border-cocoa bg-white px-5 py-3 text-[28px] font-bold">
            <span className="text-5xl">{RUSH[rush.data.label].emoji}</span>
            Right now: {RUSH[rush.data.label].word}
          </div>
        )}
        <Gate state={busyness} what="Your busy times">
          {(cells) => {
            if (cells.length === 0) return <p className="text-[24px]">Not enough sales yet to tell.</p>;
            const at = (d: number, h: number) => cells.find((c) => c.dayOfWeek === d && c.hour === h);
            const byDay = WEEK.map((d) => ({ d, total: cells.filter((c) => c.dayOfWeek === d).reduce((s, c) => s + c.salesPerHour, 0) }));
            const busiest = [...cells].sort((a, b) => b.salesPerHour - a.salesPerHour)[0];
            const quietDay = [...byDay].sort((a, b) => a.total - b.total)[0];
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border-4 border-cocoa bg-terracotta px-5 py-4 text-[26px] font-bold">
                    🔥 Busiest: {DAY_NAMES[busiest.dayOfWeek]} around {hourLabel(busiest.hour)}
                  </div>
                  <div className="rounded-3xl border-4 border-cocoa bg-sky px-5 py-4 text-[26px] font-bold">
                    😴 Quietest day: {DAY_NAMES[quietDay.d]}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-1 text-[18px] font-bold">
                    <thead>
                      <tr>
                        <th />
                        {OPEN_HOURS.map((h) => <th key={h} className="px-1 font-semibold">{hourLabel(h)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEK.map((d) => (
                        <tr key={d}>
                          <th className="pr-2 text-left">{DAY_NAMES[d].slice(0, 3)}</th>
                          {OPEN_HOURS.map((h) => {
                            const c = at(d, h);
                            return (
                              <td
                                key={h}
                                title={`${DAY_NAMES[d]} ${hourLabel(h)}: about ${Math.round(c?.salesPerHour ?? 0)} sales an hour`}
                                className="h-11 w-14 rounded-xl border-[3px] border-cocoa"
                                style={{ background: HEAT[c?.level ?? 0] }}
                              />
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[18px] font-bold">
                  Quiet {HEAT.map((c) => <span key={c} className="inline-block h-6 w-8 rounded-md border-[3px] border-cocoa" style={{ background: c }} />)} Packed
                </div>
              </>
            );
          }}
        </Gate>
      </Panel>

      <Panel title="Needs a little love" emoji="💛" sample={truths.isSample}>
        <Gate state={truths} what="Nonna's honest advice">
          {(list) =>
            list.length === 0 ? (
              <p className="text-[24px]">Every treat is doing well. Brava! 👏</p>
            ) : (
              <div className="flex flex-col gap-4">
                {list.map((t) => (
                  <article key={t.productId} className="flex flex-col gap-3 rounded-3xl border-4 border-cocoa bg-butter p-5 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-3">
                      <NonnaFace size={80} mood={products.status === "ok" && products.data.find((p) => p.productId === t.productId)?.verdict === "star" ? "proud" : "worried"} />
                      <span className="text-[64px] leading-none">{emojiOf(t.productId)}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[30px] font-bold">{nameOf(t.productId)}</h3>
                      <p className="text-[22px] font-semibold">{t.spoken ?? t.facts}</p>
                      <p className="rounded-2xl border-[3px] border-cocoa bg-white px-4 py-2 text-[22px] font-bold">💡 Try this: {t.suggestion}</p>
                    </div>
                  </article>
                ))}
              </div>
            )
          }
        </Gate>
      </Panel>
    </GrannyPage>
  );
}
