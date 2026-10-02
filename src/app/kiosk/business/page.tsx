"use client";
// Lane 4. "How's the shop?" (design/shop.html): best sellers, busy times, the Gentle Truth (Lane 3) and prices nearby (Lane 1).
import type { BusynessBucket, GentleTruth, ProductPerformance, RushStatus } from "@/lib/types";
import type { MenuItem } from "@/lib/catalog/types";
import { DAY_NAMES, hourLabel, money } from "@/components/format";
import { GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { PricesNearby } from "@/components/PricesNearby";
import { SAMPLE_BUSYNESS, SAMPLE_PRODUCTS, SAMPLE_RUSH, SAMPLE_TRUTHS } from "@/components/sampleData";
import { useApi, type ApiState } from "@/components/useApi";

const RANK_COLORS = ["#a94f1d", "#7a5a12", "#4c5a2c"];
const TREND = { rising: "going up", steady: "steady", falling: "going down" };
const RUSH = { quiet: "nice and quiet", steady: "a steady trickle", busy: "getting busy", rush: "it's a rush!" };
// level 0 (dead) → 4 (packed)
const HEAT = ["#fbf3e4", "#f3e0b0", "#e9bd6b", "#d98a3f", "#a94f1d"];
const OPEN_HOURS = Array.from({ length: 11 }, (_, i) => 7 + i); // 7am–5pm
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export function Panel({ title, sample, children }: { title: string; sample?: boolean; children: React.ReactNode }) {
  return (
    <section className="toon flex flex-col gap-6 px-8 pb-8 pt-[30px]">
      <div className="flex flex-wrap items-center gap-3.5">
        <h2 className="m-0 text-[36px]">{title}</h2>
        {sample && <span className="tag border-[1.5px] border-taupe text-ink-soft" title="The real numbers aren't connected yet">Sample numbers</span>}
      </div>
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
  const nameOf = (productId: string) =>
    (products.status === "ok" ? products.data.find((p) => p.productId === productId)?.name : undefined) ??
    (menu.status === "ok" ? menu.data.find((m) => m.id === productId)?.name : undefined) ??
    "A treat";

  return (
    <GrannyPage title="How's the shop?">
      <Panel title="Best sellers this week" sample={products.isSample}>
        <Gate state={products} what="Your best sellers">
          {(rows) => {
            const ranked = [...rows].sort((a, b) => a.rank - b.rank);
            if (ranked.every((p) => p.unitsSold === 0)) return <p className="m-0 text-[24px] font-semibold">No sales yet this week. Check back after your first customers!</p>;
            const most = Math.max(1, ...ranked.map((r) => r.unitsSold));
            return (
              <>
                <div className="grid grid-cols-3 gap-[18px]">
                  {ranked.slice(0, 3).map((p, i) => (
                    <div key={p.productId} className="flex flex-col items-center gap-2 rounded-[18px] border-[1.5px] border-linen bg-paper px-4 py-[22px] text-center">
                      <div className="font-display flex h-[54px] w-[54px] items-center justify-center rounded-full text-[28px] text-card" style={{ background: RANK_COLORS[i] }}>
                        {i + 1}
                      </div>
                      <div className="font-display text-[30px] leading-[1.1]">{p.name}</div>
                      <div className="text-[24px] font-extrabold text-ink-soft">{p.unitsSold} sold</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3.5">
                  {ranked.map((p) => (
                    <div key={p.productId} className="grid grid-cols-[250px_minmax(0,1fr)_190px] items-center gap-4 text-[22px] font-extrabold">
                      <div>{p.name}</div>
                      <div className="h-[22px] overflow-hidden rounded-full bg-[#f1e2c8]">
                        <div className="h-full rounded-full bg-[#c8642c]" style={{ width: `${Math.max(3, (p.unitsSold / most) * 100)}%` }} />
                      </div>
                      <div className="font-bold text-ink-soft"><span className="font-extrabold text-ink">{p.unitsSold}</span> · {TREND[p.trend]}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[22px] font-semibold text-ink-soft">Money in this week: {money(ranked.reduce((s, p) => s + p.revenueCents, 0))}</div>
              </>
            );
          }}
        </Gate>
      </Panel>

      <Panel title="When it gets busy" sample={busyness.isSample}>
        {rush.status === "ok" && (
          <div className="rounded-[18px] border-[1.5px] border-linen bg-paper px-[22px] py-4 text-[28px] font-extrabold">
            Right now: {RUSH[rush.data.label]}
          </div>
        )}
        <Gate state={busyness} what="Your busy times">
          {(cells) => {
            if (cells.length === 0) return <p className="m-0 text-[24px] font-semibold">Not enough sales yet to tell.</p>;
            const at = (d: number, h: number) => cells.find((c) => c.dayOfWeek === d && c.hour === h);
            const byDay = WEEK.map((d) => ({ d, total: cells.filter((c) => c.dayOfWeek === d).reduce((s, c) => s + c.salesPerHour, 0) }));
            const busiest = [...cells].sort((a, b) => b.salesPerHour - a.salesPerHour)[0];
            const quietDay = [...byDay].sort((a, b) => a.total - b.total)[0];
            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[18px] bg-tint-rust px-[22px] py-4 text-[25px] font-extrabold">
                    Busiest: {DAY_NAMES[busiest.dayOfWeek]} around {hourLabel(busiest.hour)}
                  </div>
                  <div className="rounded-[18px] bg-tint-olive px-[22px] py-4 text-[25px] font-extrabold">Quietest day: {DAY_NAMES[quietDay.d]}</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-[64px_repeat(11,minmax(0,1fr))] gap-1.5 text-center text-[18px] font-bold text-ink-soft">
                    <div />
                    {OPEN_HOURS.map((h) => <div key={h}>{hourLabel(h)}</div>)}
                  </div>
                  {WEEK.map((d) => (
                    <div key={d} className="grid grid-cols-[64px_repeat(11,minmax(0,1fr))] items-center gap-1.5">
                      <div className="text-[20px] font-extrabold">{DAY_NAMES[d].slice(0, 3)}</div>
                      {OPEN_HOURS.map((h) => {
                        const c = at(d, h);
                        return (
                          <div
                            key={h}
                            title={`${DAY_NAMES[d]} ${hourLabel(h)}: about ${Math.round(c?.salesPerHour ?? 0)} sales an hour`}
                            className="h-11 rounded-[10px] border-[1.5px] border-linen"
                            style={{ background: HEAT[c?.level ?? 0] }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[19px] font-extrabold text-ink-soft">
                  Quiet
                  {HEAT.map((c) => <span key={c} className="inline-block h-6 w-[34px] rounded-[7px] border-[1.5px] border-linen" style={{ background: c }} />)}
                  Packed
                </div>
              </>
            );
          }}
        </Gate>
      </Panel>

      <Panel title="Needs a little love" sample={truths.isSample}>
        <Gate state={truths} what="Nonna's honest advice">
          {(list) =>
            list.length === 0 ? (
              <p className="m-0 text-[24px] font-semibold">Every treat is doing well. Brava!</p>
            ) : (
              list.map((t) => (
                <article key={t.productId} className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-linen bg-paper px-6 py-[22px]">
                  <h3 className="m-0 text-[30px]">{nameOf(t.productId)}</h3>
                  <div className="text-[23px] font-semibold">{t.spoken ?? t.facts}</div>
                  <div className="rounded-[14px] border-[1.5px] border-linen bg-card px-[18px] py-3 text-[23px] font-extrabold">
                    <span className="text-rust">Try this:</span> {t.suggestion}
                  </div>
                </article>
              ))
            )
          }
        </Gate>
      </Panel>

      <PricesNearby onChanged={menu.reload} />
    </GrannyPage>
  );
}
