"use client";
// Lane 4. The pantry as real shelves: one jar per ingredient. Hover (or tap) a jar to see how much is left and when it goes off.
import { useState } from "react";
import type { IngredientStatus } from "@/lib/types";
import { amount, fromNow, ingredientEmoji } from "@/components/format";
import { GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { useApi } from "@/components/useApi";

const PER_SHELF = 6;

const LEVEL = {
  ok: { word: "Plenty", fill: "#81b29a", pill: "bg-sage" },
  low: { word: "Running low", fill: "#ffe066", pill: "bg-butter-deep" },
  out: { word: "All gone!", fill: "transparent", pill: "bg-berry text-white" },
} as const;

function chunk<T>(xs: T[], n: number): T[][] {
  return Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
}

function Jar({ s, nowMs, open, onOpen, onClose }: { s: IngredientStatus; nowMs: number; open: boolean; onOpen: () => void; onClose: () => void }) {
  const level = LEVEL[s.level];
  // How full the jar looks: one full order plus the reorder point is a "full" jar.
  const full = Math.min(1, s.totalQty / (s.ingredient.reorderQty + s.ingredient.reorderPoint));
  const fillH = Math.round(full * 78);
  const expiringSoon = s.expiringSoonQty > 0;
  const { ingredient: ing } = s;

  return (
    <div className="relative flex flex-col items-center" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        onClick={onOpen}
        onFocus={onOpen}
        onBlur={onClose}
        aria-label={`${ing.name}: ${amount(s.totalQty, ing.unit)}`}
        aria-expanded={open}
        className={`relative flex cursor-pointer flex-col items-center transition-transform duration-150 ${open ? "-translate-y-2 scale-110" : "hover:-translate-y-1"}`}
      >
        <svg width="96" height="112" viewBox="0 0 96 112" aria-hidden>
          {/* lid */}
          <rect x="22" y="2" width="52" height="14" rx="5" fill="#e07a5f" stroke="#4a2c17" strokeWidth="4" />
          {/* glass */}
          <rect x="10" y="14" width="76" height="94" rx="20" fill="#ffffff" fillOpacity="0.85" stroke="#4a2c17" strokeWidth="4" />
          {/* contents */}
          <clipPath id={`jar-${ing.id}`}>
            <rect x="12" y="16" width="72" height="90" rx="18" />
          </clipPath>
          <rect clipPath={`url(#jar-${ing.id})`} x="12" y={106 - fillH} width="72" height={fillH} fill={level.fill} opacity="0.9" />
          {/* shine */}
          <path d="M22 30 Q20 56 22 82" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9" />
        </svg>
        <span className={`pointer-events-none absolute top-[38px] text-[44px] leading-none ${s.level === "out" ? "opacity-40 grayscale" : ""}`}>
          {ingredientEmoji(ing.name)}
        </span>
        {expiringSoon && <span className="wiggle absolute -right-2 top-1 text-3xl" title="Goes off soon">⏰</span>}
        {s.level !== "ok" && <span className="absolute -left-2 top-1 text-3xl" title={level.word}>❗</span>}
      </button>
      <span className="mt-1 max-w-[110px] truncate text-center text-[18px] font-bold">{ing.name}</span>

      {open && (
        <div role="tooltip" className="toon pop-in absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[290px] -translate-x-1/2 p-5 text-left">
          <div className="font-display flex items-center gap-2 text-[30px] font-bold leading-tight">
            <span aria-hidden>{ingredientEmoji(ing.name)}</span> {ing.name}
          </div>
          <div className="mt-2 text-[24px] font-bold">We have {amount(s.totalQty, ing.unit)}{ing.unit === "pcs" ? " left" : ""}</div>
          <span className={`mt-2 inline-block rounded-full border-[3px] border-cocoa px-3 py-0.5 text-[18px] font-bold ${level.pill}`}>{level.word}</span>
          <div className="mt-3 text-[20px] font-semibold">
            {s.nextExpiry ? <>🗓️ Goes off {fromNow(s.nextExpiry, nowMs)}</> : <>🗓️ Nothing to go off</>}
          </div>
          {expiringSoon && (
            <div className="mt-1 text-[20px] font-bold text-terracotta-deep">⏰ {amount(s.expiringSoonQty, ing.unit)} goes off by tomorrow. Use it first!</div>
          )}
          {s.openReorderId && <div className="mt-1 text-[20px] font-semibold">🚚 More is ordered</div>}
          {/* little arrow */}
          <span aria-hidden className="absolute -bottom-[16px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[16px] border-x-transparent border-t-cocoa" />
        </div>
      )}
    </div>
  );
}

function Shelf({ title, items, nowMs, open, setOpen }: { title: string; items: IngredientStatus[]; nowMs: number; open: string | null; setOpen: (id: string | null) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="toon overflow-visible bg-[#fbe3c4] p-5 pt-4">
      <h2 className="mb-2 text-[30px] font-bold">{title}</h2>
      <div className="flex flex-col gap-10 pt-24">
        {chunk(items, PER_SHELF).map((row, i) => (
          <div key={i} className="relative">
            <div className="relative z-10 grid grid-cols-3 justify-items-center gap-y-4 px-2 pb-1 sm:grid-cols-6">
              {row.map((s) => (
                <Jar key={s.ingredient.id} s={s} nowMs={nowMs} open={open === s.ingredient.id} onOpen={() => setOpen(s.ingredient.id)} onClose={() => setOpen(null)} />
              ))}
            </div>
            {/* the wooden plank */}
            <div className="relative h-7 rounded-lg border-4 border-cocoa bg-wood shadow-[0_6px_0_var(--wood-dark)]">
              <div className="absolute inset-x-3 top-1 h-1 rounded bg-white/30" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Pantry() {
  const inventory = useApi<IngredientStatus[]>("/api/inventory", { pollMs: 5000 });
  const clock = useApi<{ now: string }>("/api/sim", { pollMs: 5000 });
  const [open, setOpen] = useState<string | null>(null);

  if (inventory.status === "loading") return <GrannyPage title="My pantry" emoji="🧺"><Loading /></GrannyPage>;
  if (inventory.status !== "ok") {
    return <GrannyPage title="My pantry" emoji="🧺"><StillCooking what="The pantry" error={inventory.status === "error"} /></GrannyPage>;
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
    <GrannyPage title="My pantry" emoji="🧺">
      <NonnaSays mood={words.length ? "worried" : "proud"}>
        {words.length ? `Heads up: ${words.join(", and ")}.` : "The shelves look lovely, everything is stocked!"}{" "}
        <span className="text-cocoa-soft">Touch a jar to see more.</span>
      </NonnaSays>
      <Shelf title="❄️ The fridge" items={fridge} nowMs={nowMs} open={open} setOpen={setOpen} />
      <Shelf title="🗄️ The cupboard" items={cupboard} nowMs={nowMs} open={open} setOpen={setOpen} />
    </GrannyPage>
  );
}
