"use client";
// Lane 4. The grandson's back office (design/dashboard.html): what needs a yes, the live feed, the whole
// inventory with an Order button per row, and the shop's numbers in compact form.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BusynessBucket, GentleTruth, IngredientStatus, NonnaNotification, ProductPerformance, Reorder, RushStatus, Supplier } from "@/lib/types";
import { amount, DAY_NAMES, fromNow, hourLabel, money } from "@/components/format";
import { Loading, StillCooking } from "@/components/GrannyPage";
import { SAMPLE_BUSYNESS, SAMPLE_PRODUCTS, SAMPLE_RUSH, SAMPLE_TRUTHS } from "@/components/sampleData";
import { send, useApi, type ApiState } from "@/components/useApi";

const HEAT = ["#fbf3e4", "#f3e0b0", "#e9bd6b", "#d98a3f", "#a94f1d"];
const OPEN_HOURS = Array.from({ length: 11 }, (_, i) => 7 + i);
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const RUSH = { quiet: "nice and quiet", steady: "a steady trickle", busy: "getting busy", rush: "it's a rush!" };
const RUSH_DOTS = { quiet: 1, steady: 2, busy: 3, rush: 4 };
const TREND = { rising: { arrow: "↑", color: "#4c5a2c", word: "going up" }, steady: { arrow: "→", color: "#5c3d27", word: "steady" }, falling: { arrow: "↓", color: "#8a3324", word: "going down" } };
const SEVERITY = {
  urgent: "bg-wine text-card",
  nudge: "bg-tint-gold text-[#5a4208]",
  info: "bg-tint-olive text-[#333f1c]",
};

const smallBtn = "min-h-11 rounded-full border-[1.5px] border-taupe bg-card px-5 text-[15px] font-extrabold disabled:opacity-50";

function Card({ title, sample, badge, children }: { title: string; sample?: boolean; badge?: number; children: React.ReactNode }) {
  return (
    <section className="toon flex flex-col gap-3.5 rounded-[18px] px-6 pb-6 pt-[22px]">
      <div className="flex items-center gap-2.5">
        <h2 className="m-0 text-[24px]">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-wine px-2 text-[15px] font-extrabold text-card">{badge}</span>
        )}
        {sample && <span className="rounded-full border-[1.5px] border-taupe px-2.5 py-px text-[12px] font-extrabold text-ink-soft">Sample numbers</span>}
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

export default function Dashboard() {
  const inventory = useApi<IngredientStatus[]>("/api/inventory", { pollMs: 5000 });
  const reorders = useApi<Reorder[]>("/api/reorders", { pollMs: 5000 });
  const suppliers = useApi<Supplier[]>("/api/suppliers");
  const ramp = useApi<{ autopilot: { maxOrderCents: number } }>("/api/ramp");
  const clock = useApi<{ now: string }>("/api/sim", { pollMs: 5000 });
  const products = useApi<ProductPerformance[]>("/api/analytics/products?days=7", { sample: SAMPLE_PRODUCTS, pollMs: 15000 });
  const busyness = useApi<BusynessBucket[]>("/api/analytics/busyness?days=28", { sample: SAMPLE_BUSYNESS });
  const rush = useApi<RushStatus>("/api/analytics/rush", { pollMs: 10000, sample: SAMPLE_RUSH });
  const truths = useApi<GentleTruth[]>("/api/analytics/truths?days=14", { sample: SAMPLE_TRUTHS });
  const [feed, setFeed] = useState<NonnaNotification[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reloadOrders = reorders.reload;
  const reloadStock = inventory.reload;
  const refresh = useCallback(() => {
    reloadOrders();
    reloadStock();
  }, [reloadOrders, reloadStock]);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; notification?: NonnaNotification };
      if (data.type === "notification" && data.notification) {
        setFeed((f) => [data.notification!, ...f].slice(0, 12));
        refresh();
      }
    };
    return () => source.close();
  }, [refresh]);

  const nowMs = clock.status === "ok" ? new Date(clock.data.now).getTime() : 0;
  const stock = inventory.status === "ok" ? inventory.data : [];
  const ingredient = (id: string) => stock.find((s) => s.ingredient.id === id);
  const supplier = (id: string) => (suppliers.status === "ok" ? suppliers.data.find((s) => s.id === id) : undefined);
  const orders = reorders.status === "ok" ? reorders.data : [];
  const waiting = orders.filter((r) => r.status === "proposed");
  const cap = ramp.status === "ok" ? ramp.data.autopilot.maxOrderCents : undefined;

  async function act(path: string, label: string, body?: unknown) {
    setBusy(path);
    const res = await send(path, { body });
    setBusy(null);
    setNote(res.ok ? label : res.status === 402 ? "The supplier's card declined it (limit or frozen)." : (res.data.error ?? "That didn't work."));
    setTimeout(() => setNote(null), 6000);
    refresh();
  }

  return (
    <main className="mx-auto flex w-[1320px] max-w-full flex-1 flex-col gap-[22px] px-10 pb-12 pt-[26px] text-[16px]">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="text-[14px] font-extrabold uppercase tracking-[0.14em] text-rust">Nonna&apos;s bakery</div>
          <h1 className="m-0 text-[38px] leading-[1.1]">Back office</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {rush.status === "ok" && (
            <div className="flex min-h-11 items-center gap-2.5 rounded-full border-[1.5px] border-linen bg-card px-4 text-[16px] font-extrabold">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: i <= RUSH_DOTS[rush.data.label] ? "#c8642c" : "#e6d3b3" }} />
                ))}
              </div>
              Right now: {RUSH[rush.data.label]}
            </div>
          )}
          {[["/kiosk", "Kiosk"], ["/pos", "Till"], ["/demo", "Demo"]].map(([href, label]) => (
            <Link key={href} href={href} className="flex min-h-11 items-center rounded-full border-[1.5px] border-taupe bg-card px-[18px] text-[16px] font-extrabold">
              {label}
            </Link>
          ))}
        </div>
      </header>

      {note && <p className="pop-in m-0 rounded-xl bg-tint-olive px-4 py-2.5 text-[16px] font-extrabold">{note}</p>}

      <div className="grid grid-cols-2 gap-[22px]">
        <Card title="Needs a yes" badge={waiting.length}>
          {reorders.status !== "ok" ? (
            <Gate state={reorders} what="Reorders">{() => null}</Gate>
          ) : waiting.length === 0 ? (
            <p className="m-0 text-[16px] font-semibold text-ink-soft">Nothing waiting. Nonna will ask when something needs buying.</p>
          ) : (
            waiting.map((r) => {
              const s = ingredient(r.ingredientId);
              const sup = supplier(r.supplierId);
              return (
                <div key={r.id} className="flex flex-col gap-3 border-b-[1.5px] border-dotted border-[#c9ad84] pb-3.5 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex flex-col gap-1">
                      <div className="font-display text-[26px] leading-[1.15]">
                        {s ? `${amount(r.qty, s.ingredient.unit)} ${s.ingredient.unit === "pcs" ? "×" : "of"} ${s.ingredient.name.toLowerCase()}` : "…"}
                      </div>
                      <div className="text-[17px] font-extrabold">from {sup?.name ?? "…"}</div>
                      {s && (
                        <div className="text-[16px] font-semibold text-ink-soft">
                          {s.level === "out" ? "All gone" : "Running low"}: {amount(s.totalQty, s.ingredient.unit)} left, reorder point {amount(s.ingredient.reorderPoint, s.ingredient.unit)}.
                          {sup ? ` Arrives in ${sup.leadTimeHours} hours.` : ""}
                        </div>
                      )}
                    </div>
                    <div className="font-display text-[38px] leading-none">{money(r.costCents)}</div>
                  </div>
                  {(r.note || cap !== undefined) && (
                    <div className="rounded-xl bg-paper px-3.5 py-2.5 text-[15px] font-bold text-ink-soft">
                      {cap !== undefined && r.costCents > cap ? `Over the ${money(cap)} autopilot cap, so Nonna asks first.` : r.reason === "manual" || r.reason === "forecast" ? "Not a routine restock, so Nonna asks first." : r.note}
                    </div>
                  )}
                  <div className="flex gap-2.5">
                    <button className="min-h-[46px] rounded-full bg-olive px-6 text-[17px] font-extrabold text-card shadow-[0_3px_0_#333f1c] disabled:opacity-50" disabled={busy !== null} onClick={() => act(`/api/reorders/${r.id}/approve`, "Approved and paid on the supplier card.")}>
                      Approve
                    </button>
                    <button className={smallBtn} disabled={busy !== null} onClick={() => act(`/api/reorders/${r.id}/cancel`, "Cancelled.")}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </Card>

        <Card title="Live feed">
          {feed.length === 0 ? (
            <p className="m-0 text-[16px] font-semibold text-ink-soft">Quiet so far. What Nonna says shows up here as it happens.</p>
          ) : (
            <div className="flex flex-col">
              {feed.map((n) => (
                <div key={n.id} className="flex items-start gap-3 border-b-[1.5px] border-dotted border-[#c9ad84] py-2.5 last:border-0">
                  <span className={`w-16 shrink-0 rounded-full py-0.5 text-center text-[13px] font-extrabold ${SEVERITY[n.severity]}`}>{n.severity}</span>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[16px] font-bold">{n.text}</div>
                    {n.spoken && n.spoken !== n.text && <div className="text-[15px] italic text-ink-soft">&ldquo;{n.spoken}&rdquo;</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Inventory">
        <Gate state={inventory} what="The inventory">
          {(rows) => (
            <div className="flex flex-col">
              <div className="grid grid-cols-[1.5fr_0.9fr_1.7fr_1.1fr_1.8fr_150px] gap-3.5 border-b-[1.5px] border-ink px-1 py-2 text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-soft">
                <div>Ingredient</div><div>On hand</div><div>Level</div><div>Goes off</div><div>Supplier</div><div>Reorder</div>
              </div>
              {rows.map((s) => {
                const full = Math.min(1, s.totalQty / (s.ingredient.reorderQty + s.ingredient.reorderPoint));
                const open = s.openReorderId ? orders.find((r) => r.id === s.openReorderId) : undefined;
                const sup = supplier(s.ingredient.supplierId);
                const goesOff = s.nextExpiry && nowMs && (new Date(s.nextExpiry).getTime() - nowMs) / 86_400_000 < 365 ? fromNow(s.nextExpiry, nowMs) : "—";
                return (
                  <div key={s.ingredient.id} className="grid min-h-[52px] grid-cols-[1.5fr_0.9fr_1.7fr_1.1fr_1.8fr_150px] items-center gap-3.5 border-b-[1.5px] border-dotted border-[#c9ad84] px-1 text-[16px] font-bold">
                    <div className="font-extrabold">{s.ingredient.name}</div>
                    <div className="tabular-nums">{amount(s.totalQty, s.ingredient.unit)}</div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-2.5 max-w-[110px] flex-1 overflow-hidden rounded-full bg-[#f1e2c8]">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(full * 100)}%`, background: s.level === "ok" ? "#8a9a5b" : "#d9a441" }} />
                      </div>
                      {s.level === "out" ? (
                        <span className="rounded-full bg-wine px-3 py-0.5 text-[13px] font-extrabold text-card">Out</span>
                      ) : s.level === "low" ? (
                        <span className="rounded-full bg-tint-gold px-3 py-0.5 text-[13px] font-extrabold text-[#5a4208]">Low</span>
                      ) : (
                        <span className="rounded-full bg-tint-olive px-3 py-0.5 text-[13px] font-extrabold text-[#333f1c]">OK</span>
                      )}
                    </div>
                    <div className={s.expiringSoonQty > 0 ? "font-extrabold text-wine" : ""}>{goesOff}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <div>{sup?.name ?? "…"}</div>
                      {sup?.isLocal && <span className="rounded-full border-[1.5px] border-[#6b7a4a] px-[9px] py-px text-[12px] font-extrabold text-olive">local</span>}
                    </div>
                    <div>
                      {open?.status === "proposed" ? (
                        <div className="text-[14px] font-extrabold text-wine">Waiting for a yes</div>
                      ) : open?.status === "placed" ? (
                        <div className="text-[14px] font-extrabold text-olive">On the way</div>
                      ) : (
                        <button className={smallBtn} disabled={busy !== null} onClick={() => act("/api/reorders", `Order for ${s.ingredient.name.toLowerCase()} is ready for a yes.`, { ingredientId: s.ingredient.id })}>
                          Order
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Gate>
      </Card>

      <div className="grid grid-cols-3 gap-[22px]">
        <Card title="Best sellers this week" sample={products.isSample}>
          <Gate state={products} what="Best sellers">
            {(rows) => {
              const ranked = [...rows].sort((a, b) => a.rank - b.rank);
              const most = Math.max(1, ...ranked.map((p) => p.unitsSold));
              return (
                <>
                  <div className="flex flex-col gap-2.5">
                    {ranked.map((p) => (
                      <div key={p.productId} className="grid grid-cols-[150px_minmax(0,1fr)_44px_26px] items-center gap-2.5 text-[15px] font-extrabold">
                        <div className="truncate">{p.name}</div>
                        <div className="h-3 overflow-hidden rounded-full bg-[#f1e2c8]">
                          <div className="h-full rounded-full bg-[#c8642c]" style={{ width: `${Math.max(2, (p.unitsSold / most) * 100)}%` }} />
                        </div>
                        <div className="text-right tabular-nums">{p.unitsSold}</div>
                        <div aria-label={TREND[p.trend].word} className="text-[17px]" style={{ color: TREND[p.trend].color }}>{TREND[p.trend].arrow}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[15px] font-bold text-ink-soft">Money in this week: {money(ranked.reduce((s, p) => s + p.revenueCents, 0))}</div>
                </>
              );
            }}
          </Gate>
        </Card>

        <Card title="When it gets busy" sample={busyness.isSample}>
          <Gate state={busyness} what="Busy times">
            {(cells) => {
              if (cells.length === 0) return <p className="m-0 font-semibold text-ink-soft">Not enough sales yet.</p>;
              const at = (d: number, h: number) => cells.find((c) => c.dayOfWeek === d && c.hour === h);
              const busiest = [...cells].sort((a, b) => b.salesPerHour - a.salesPerHour)[0];
              const quiet = WEEK.map((d) => ({ d, t: cells.filter((c) => c.dayOfWeek === d).reduce((s, c) => s + c.salesPerHour, 0) })).sort((a, b) => a.t - b.t)[0];
              return (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-[34px_repeat(11,minmax(0,1fr))] gap-1 text-center text-[12px] font-extrabold text-ink-soft">
                      <div />
                      {OPEN_HOURS.map((h) => <div key={h}>{h > 12 ? h - 12 : h}</div>)}
                    </div>
                    {WEEK.map((d) => (
                      <div key={d} className="grid grid-cols-[34px_repeat(11,minmax(0,1fr))] items-center gap-1">
                        <div className="text-[13px] font-extrabold">{DAY_NAMES[d].slice(0, 3)}</div>
                        {OPEN_HOURS.map((h) => (
                          <div key={h} title={`${DAY_NAMES[d]} ${hourLabel(h)}`} className="h-[26px] rounded-md border border-linen" style={{ background: HEAT[at(d, h)?.level ?? 0] }} />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="text-[15px] font-bold text-ink-soft">
                    Busiest: {DAY_NAMES[busiest.dayOfWeek]} around {hourLabel(busiest.hour)}. Quietest day: {DAY_NAMES[quiet.d]}.
                  </div>
                </>
              );
            }}
          </Gate>
        </Card>

        <Card title="Needs a little love" sample={truths.isSample}>
          <Gate state={truths} what="Gentle truths">
            {(list) =>
              list.length === 0 ? (
                <p className="m-0 font-semibold text-ink-soft">Every treat is doing well.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {list.map((t, i) => (
                    <div key={t.productId} className={`flex flex-col gap-1.5 ${i ? "border-t-[1.5px] border-dotted border-[#c9ad84] pt-3" : ""}`}>
                      <div className="font-display text-[20px]">
                        {(products.status === "ok" ? products.data.find((p) => p.productId === t.productId)?.name : undefined) ?? "A treat"}
                      </div>
                      <div className="text-[16px] font-bold">{t.facts}</div>
                      <div className="text-[15px] italic text-ink-soft">&ldquo;{t.suggestion}&rdquo;</div>
                    </div>
                  ))}
                </div>
              )
            }
          </Gate>
        </Card>
      </div>
    </main>
  );
}
