"use client";
// Lane 4. The presenter's remote control (design/demo.html). Spec: docs/DEMO.md
// Moves the demo clock (/api/sim), fires a rush of sales (/api/sales), starts the trade war (/api/suppliers/price),
// runs the Price Watch sale lever, and resets the world.
import { useState } from "react";
import type { MenuItem } from "@/lib/catalog/types";
import { DAY_NAMES } from "@/components/format";
import { send, useApi } from "@/components/useApi";

// Rush mix: croissants and coffee dominate, parfaits next (weights per product id, others get 1).
const RUSH_WEIGHTS: Record<string, number> = { prd_croissant: 5, prd_latte: 4, prd_espresso: 3, prd_fall_parfait: 3, prd_berry_parfait: 2 };

// Tiny seeded PRNG (xorshift32), so a rehearsed rush plays out the same way each time.
let seed = 42;
function randInt(n: number): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) % n;
}

const clockBtn = "min-h-[60px] rounded-2xl border-[1.5px] border-taupe bg-paper px-[18px] text-[20px] font-extrabold disabled:opacity-50";
const storyBtn = "font-display min-h-[60px] shrink-0 rounded-full px-7 text-[22px] text-card disabled:opacity-50";

function Story({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border-[1.5px] border-linen bg-paper px-[18px] py-4">
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="text-[21px] font-extrabold">{title}</div>
        <div className="text-[17px] font-semibold text-ink-soft">{note}</div>
      </div>
      {children}
    </div>
  );
}

export default function Demo() {
  const clock = useApi<{ now: string }>("/api/sim", { pollMs: 2000 });
  const menu = useApi<MenuItem[]>("/api/menu");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const now = clock.status === "ok" ? new Date(clock.data.now) : null;

  async function run(label: string, fn: () => Promise<{ ok: boolean; data: { error?: string } }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setLast(res.ok ? label : `Didn't work: ${res.data.error ?? "unknown error"}`);
    clock.reload();
  }

  const advance = (hours: number, label: string) => run(label, () => send("/api/sim", { body: { advanceHours: hours } }));

  function jumpToSaturday11() {
    if (!now) return;
    const target = new Date(now);
    target.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
    target.setHours(11, 0, 0, 0);
    return advance((target.getTime() - now.getTime()) / 3_600_000, "Jumped to Saturday 11:00");
  }

  async function fireRush() {
    if (menu.status !== "ok") return;
    setBusy(true);
    const pool = menu.data.flatMap((m) => Array(RUSH_WEIGHTS[m.id] ?? 1).fill(m.id) as string[]);
    let ok = 0;
    for (let i = 0; i < 20; i++) {
      const productId = pool[randInt(pool.length)];
      const res = await send("/api/sales", { body: { items: [{ productId, qty: 1 + randInt(2) }], paymentMethod: i % 3 ? "card" : "cash" } });
      if (res.ok) ok++;
      await new Promise((r) => setTimeout(r, 400));
    }
    setBusy(false);
    setLast(`Rush done: ${ok} of 20 sales went through`);
  }

  return (
    <main className="mx-auto flex w-[860px] max-w-full flex-1 flex-col gap-[22px] px-10 pb-11 pt-7 text-[18px]">
      <header className="flex flex-col gap-1">
        <div className="text-[15px] font-extrabold uppercase tracking-[0.14em] text-rust">Nonna&apos;s bakery · presenter</div>
        <h1 className="m-0 text-[40px] leading-[1.1]">Demo control</h1>
      </header>

      <section className="toon flex flex-col gap-[18px] rounded-[20px] px-[26px] pb-[26px] pt-6">
        <div className="flex items-baseline justify-between gap-5">
          <h2 className="m-0 text-[26px]">Demo clock</h2>
          <div className="text-[16px] font-bold text-ink-soft">The whole shop runs on this time</div>
        </div>
        <div className="font-display text-[60px] leading-[1.05]">
          {now ? `${DAY_NAMES[now.getDay()]}, ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()}` : "…"}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <button className={clockBtn} disabled={busy} onClick={() => advance(1, "+1 hour")}>+1 hour</button>
          <button className={clockBtn} disabled={busy} onClick={() => advance(24, "+1 day")}>+1 day</button>
          <button className={clockBtn} disabled={busy} onClick={jumpToSaturday11}>Jump to Saturday 11:00</button>
          <button
            className="min-h-[60px] rounded-2xl border-[1.5px] border-dashed border-taupe px-[18px] text-[20px] font-extrabold text-ink-soft disabled:opacity-50"
            disabled={busy}
            onClick={() => run("Clock back to real time", () => send("/api/sim", { body: { reset: true } }))}
          >
            Reset clock
          </button>
        </div>
      </section>

      <section className="toon flex flex-col gap-3.5 rounded-[20px] px-[26px] pb-[26px] pt-6">
        <h2 className="m-0 text-[26px]">Story buttons</h2>
        <Story title="Fire a rush" note="20 random sales over a few seconds. The rush meter goes red and Nonna keeps quiet.">
          <button className={`${storyBtn} bg-rust shadow-[0_4px_0_#7c3812]`} disabled={busy} onClick={fireRush}>Fire a rush</button>
        </Story>
        <Story title="+1 day (watch the berries go off)" note="Mixed berries expire in about 20 hours, so one day forward logs them as waste.">
          <button className={`${storyBtn} bg-rust shadow-[0_4px_0_#7c3812]`} disabled={busy} onClick={() => advance(24, "Skipped a day")}>Skip a day</button>
        </Story>
        <Story title="Trade war" note="Gerald's Dairy raises heavy cream by 36%. Nonna works out the margin hit and whether to switch to Maple Hill Creamery.">
          <button
            className={`${storyBtn} bg-wine shadow-[0_4px_0_#5e2117]`}
            disabled={busy}
            onClick={() => run("Gerald raised the price of cream", () => send("/api/suppliers/price", { body: { supplierId: "sup_gerald", ingredientId: "ing_cream", unitCostCents: 0.95 } }))}
          >
            Start trade war
          </button>
        </Story>
        <Story title="The Bakery runs a sale" note="The Bakery's website drops its parfait to $6.95. Prices nearby shows what Nonna would do.">
          <button
            className={`${storyBtn} bg-ochre shadow-[0_4px_0_#4f3a0b]`}
            disabled={busy}
            onClick={() => run("The Bakery is running a sale", () => send("/api/pricewatch/refresh", { body: { mockVariant: "sale" } }))}
          >
            Start the sale
          </button>
        </Story>
      </section>

      <section className="flex items-center gap-5 rounded-[20px] border-[1.5px] border-dashed border-taupe px-[26px] py-5">
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="text-[21px] font-extrabold">Reset world</div>
          <div className="text-[17px] font-semibold text-ink-soft">Wipes the database and re-seeds the catalogue and starting stock.</div>
        </div>
        <button
          className="min-h-[60px] shrink-0 rounded-full border-[1.5px] border-wine bg-card px-7 text-[20px] font-extrabold text-wine disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Wipe the database and start the demo over?")) run("World reset", () => send("/api/sim", { body: { resetWorld: true } }));
          }}
        >
          Reset world
        </button>
      </section>

      {last && <p className="pop-in m-0 text-[18px] font-bold text-ink-soft">Last: {last}</p>}
    </main>
  );
}
