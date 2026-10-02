"use client";
// Lane 4. The pantry as real shelves (design/pantry.html): one jar per ingredient, filled to how much is left,
// with the name, amount and expiry written under the plank. Hovering a jar lifts it.
import type { IngredientStatus } from "@/lib/types";
import { amount, fromNow } from "@/components/format";
import { GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { useApi } from "@/components/useApi";

const PER_SHELF = 7;
const FILL = { ok: "#c9d2a6", low: "#e3b04b", soon: "#d9824a" };

function chunk<T>(xs: T[], n: number): T[][] {
  return Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
}

function expiry(s: IngredientStatus, nowMs: number): string {
  if (!s.nextExpiry || !nowMs) return "";
  const days = (new Date(s.nextExpiry).getTime() - nowMs) / 86_400_000;
  return days > 365 ? "" : `Goes off ${fromNow(s.nextExpiry, nowMs)}`;
}

function Shelf({ title, items, nowMs }: { title: string; items: IngredientStatus[]; nowMs: number }) {
  if (items.length === 0) return null;
  return (
    <section className="toon flex flex-col gap-[18px] px-7 pb-[30px] pt-7">
      <h2 className="m-0 text-[34px]">{title}</h2>
      {chunk(items, PER_SHELF).map((row, i) => (
        <div key={i} className="flex flex-col">
          <div className="grid grid-cols-7 items-end gap-2 px-1.5">
            {row.map((s) => {
              const soon = s.expiringSoonQty > 0;
              const full = Math.min(1, s.totalQty / (s.ingredient.reorderQty + s.ingredient.reorderPoint));
              const fill = soon ? FILL.soon : s.level === "ok" ? FILL.ok : FILL.low;
              return (
                <div key={s.ingredient.id} className="group flex flex-col items-center" title={`${s.ingredient.name}: ${amount(s.totalQty, s.ingredient.unit)}`}>
                  <div className="flex flex-col items-center transition-transform duration-150 group-hover:-translate-y-1.5">
                    <div className="h-[13px] w-[54px] rounded-[5px_5px_2px_2px] bg-rust" />
                    <div className="relative h-[108px] w-[92px] overflow-hidden rounded-[16px_16px_22px_22px] border-2 border-ink bg-[#fffdf8]">
                      <div className="absolute inset-x-0 bottom-0" style={{ height: `${Math.round(full * 100)}%`, background: fill }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div aria-hidden className="h-3.5 rounded-[5px] bg-wood shadow-[0_4px_0_var(--wood-dark)]" />
          <div className="grid grid-cols-7 gap-2 px-1.5 pt-1.5">
            {row.map((s) => {
              const soon = s.expiringSoonQty > 0;
              return (
                <div key={s.ingredient.id} className="flex flex-col items-center gap-1 text-center">
                  <div className="text-[21px] font-extrabold leading-[1.15]">{s.ingredient.name}</div>
                  <div className="font-display text-[24px] text-rust">{amount(s.totalQty, s.ingredient.unit)}</div>
                  <div className="text-[18px] font-semibold leading-[1.2] text-ink-soft">{expiry(s, nowMs)}</div>
                  {s.level === "out" ? (
                    <div className="tag mt-1 bg-wine text-card">All gone</div>
                  ) : soon ? (
                    <div className="tag mt-1 bg-tint-rust text-[#8a3f14]">Use first</div>
                  ) : s.level === "low" ? (
                    <div className="tag mt-1 bg-tint-gold text-[#5a4208]">Running low</div>
                  ) : null}
                  {s.openReorderId && <div className="text-[17px] font-bold text-ink-soft">More is ordered</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Pantry() {
  const inventory = useApi<IngredientStatus[]>("/api/inventory", { pollMs: 5000 });
  const clock = useApi<{ now: string }>("/api/sim", { pollMs: 5000 });

  if (inventory.status === "loading") return <GrannyPage title="My pantry"><Loading /></GrannyPage>;
  if (inventory.status !== "ok") {
    return <GrannyPage title="My pantry"><StillCooking what="The pantry" error={inventory.status === "error"} /></GrannyPage>;
  }

  const nowMs = clock.status === "ok" ? new Date(clock.data.now).getTime() : 0;
  const all = inventory.data;
  // Perishables live in the fridge, the rest in the cupboard.
  const fridge = all.filter((s) => s.ingredient.shelfLifeDays <= 14);
  const cupboard = all.filter((s) => s.ingredient.shelfLifeDays > 14);
  const low = all.filter((s) => s.level !== "ok");
  const soon = all.filter((s) => s.expiringSoonQty > 0);

  const words = [
    low.length ? `${low.length} ${low.length === 1 ? "thing is" : "things are"} running low` : "",
    soon.length ? `use the ${soon.map((s) => s.ingredient.name.toLowerCase()).join(" and ")} first, ${soon.length === 1 ? "it's" : "they're"} going off soon` : "",
  ].filter(Boolean);

  return (
    <GrannyPage title="My pantry">
      <NonnaSays>{words.length ? `Heads up: ${words.join(", and ")}.` : "The shelves look lovely, everything is stocked!"}</NonnaSays>
      <Shelf title="The fridge" items={fridge} nowMs={nowMs} />
      <Shelf title="The cupboard" items={cupboard} nowMs={nowMs} />
    </GrannyPage>
  );
}
