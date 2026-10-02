"use client";
// Lane 4. The presenter's remote control. Spec: docs/DEMO.md
// Moves the demo clock (/api/sim), fires a rush of sales (/api/sales) and the Price Watch sale lever.
import Link from "next/link";
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

export default function Demo() {
  const clock = useApi<{ now: string }>("/api/sim", { pollMs: 2000 });
  const menu = useApi<MenuItem[]>("/api/menu");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const note = (line: string) => setLog((l) => [line, ...l].slice(0, 12));

  const now = clock.status === "ok" ? new Date(clock.data.now) : null;

  async function advance(hours: number, label: string) {
    const res = await send<{ now: string }>("/api/sim", { body: { advanceHours: hours } });
    note(res.ok ? `⏩ ${label}` : `😳 clock: ${res.data.error}`);
    clock.reload();
  }

  async function jumpToSaturday11() {
    if (!now) return;
    const target = new Date(now);
    target.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
    target.setHours(11, 0, 0, 0);
    await advance((target.getTime() - now.getTime()) / 3_600_000, "Jumped to Saturday 11:00");
  }

  async function resetClock() {
    await send("/api/sim", { body: { reset: true } });
    note("⏮️ Clock back to real time");
    clock.reload();
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
    note(`🔥 Rush: ${ok}/20 sales went through`);
  }

  async function bakerySale() {
    const res = await send("/api/pricewatch/refresh", { body: { mockVariant: "sale" } });
    note(res.ok ? "🏷️ The Bakery is running a sale" : `😳 price watch: ${res.data.error}`);
  }

  const buttons: { label: string; run: () => void; color: string }[] = [
    { label: "+1 hour", run: () => advance(1, "+1 hour"), color: "bg-white" },
    { label: "+1 day (watch the berries die)", run: () => advance(24, "+1 day"), color: "bg-white" },
    { label: "Jump to Saturday 11:00", run: jumpToSaturday11, color: "bg-white" },
    { label: "Reset clock", run: resetClock, color: "bg-white" },
    { label: "🔥 Fire a rush (20 sales)", run: fireRush, color: "bg-terracotta" },
    { label: "🏷️ The Bakery runs a sale", run: bakerySale, color: "bg-butter-deep" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-6">
      <header className="flex flex-wrap items-center gap-4">
        <Link href="/kiosk" className="big-btn min-h-[60px] text-[22px]">🏠 Kiosk</Link>
        <h1 className="text-[40px] font-bold">🎬 Demo control</h1>
      </header>

      <div className="toon flex items-center gap-4 p-6">
        <span className="text-6xl">🕰️</span>
        <div>
          <div className="text-[20px] font-bold text-cocoa-soft">Demo clock</div>
          <div className="font-display text-[36px] font-bold">
            {now ? `${DAY_NAMES[now.getDay()]} ${now.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "…"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {buttons.map((b) => (
          <button key={b.label} className={`big-btn text-[24px] ${b.color}`} disabled={busy} onClick={b.run}>
            {b.label}
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <ul className="toon flex flex-col gap-1 p-5 text-[20px] font-semibold">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </main>
  );
}
