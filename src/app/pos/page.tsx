"use client";
// Lane 4 (UI) + Lane 3 (POST /api/sales). Stands in for Grandma's standalone Verifone.
// Every sale here eats stock through the recipes (Lane 1) and feeds the analytics (Lane 3).
import Link from "next/link";
import { useState } from "react";
import type { PaymentMethod } from "@/lib/types";
import type { MenuItem } from "@/lib/catalog/types";
import { money } from "@/components/format";
import { Loading, StillCooking } from "@/components/GrannyPage";
import { send, useApi } from "@/components/useApi";

export default function Pos() {
  const menu = useApi<MenuItem[]>("/api/menu");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const items = menu.status === "ok" ? menu.data : [];
  const lines = items.filter((m) => cart[m.id]).map((m) => ({ item: m, qty: cart[m.id] }));
  const total = lines.reduce((s, l) => s + l.item.priceCents * l.qty, 0);
  const add = (id: string, d: number) =>
    setCart((c) => {
      const qty = Math.max(0, (c[id] ?? 0) + d);
      const next = { ...c, [id]: qty };
      if (qty === 0) delete next[id];
      return next;
    });

  async function pay(paymentMethod: PaymentMethod) {
    setBusy(true);
    const res = await send<{ totalCents: number }>("/api/sales", {
      body: { items: lines.map((l) => ({ productId: l.item.id, qty: l.qty })), paymentMethod },
    });
    setBusy(false);
    if (res.ok) {
      setCart({});
      setFlash(`${paymentMethod === "card" ? "💳" : "💵"} Paid ${money(res.data.totalCents)}. Grazie!`);
    } else {
      setFlash(`😳 ${res.status === 501 ? "The till isn't connected yet." : (res.data.error ?? "That sale didn't go through.")}`);
    }
    setTimeout(() => setFlash(null), 4000);
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-5 py-6 lg:grid-cols-[1fr_380px]">
      <section className="flex flex-col gap-5">
        <header className="flex flex-wrap items-center gap-4">
          <Link href="/kiosk" className="big-btn min-h-[60px] bg-white text-[22px]">🏠 Home</Link>
          <h1 className="text-[40px] font-bold">🧾 Till</h1>
        </header>
        {menu.status === "loading" && <Loading />}
        {(menu.status === "cooking" || menu.status === "error") && <StillCooking what="The menu" error={menu.status === "error"} />}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => (
            <button key={m.id} type="button" className="tile relative py-5 text-[22px]" onClick={() => add(m.id, 1)}>
              <span className="text-[64px] leading-none">{m.emoji}</span>
              <span className="text-center leading-tight">{m.name}</span>
              <span className="font-display text-[24px] text-terracotta-deep">{money(m.priceCents)}</span>
              {cart[m.id] && (
                <span className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-cocoa bg-berry font-display text-[22px] text-white">
                  {cart[m.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <aside className="toon flex h-fit flex-col gap-4 p-6 lg:sticky lg:top-6">
        <h2 className="text-[32px] font-bold">This order</h2>
        {lines.length === 0 && <p className="text-[22px] text-cocoa-soft">Tap a treat to add it.</p>}
        <ul className="flex flex-col gap-3">
          {lines.map(({ item, qty }) => (
            <li key={item.id} className="flex items-center gap-3 text-[22px] font-bold">
              <span className="text-3xl">{item.emoji}</span>
              <span className="flex-1">{qty} × {item.name}</span>
              <button type="button" className="h-10 w-10 rounded-full border-[3px] border-cocoa bg-white text-[22px]" aria-label={`One less ${item.name}`} onClick={() => add(item.id, -1)}>−</button>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t-4 border-dashed border-cocoa pt-3">
          <span className="text-[26px] font-bold">Total</span>
          <span className="font-display text-[44px] font-bold">{money(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="big-btn bg-sky text-[26px]" disabled={busy || lines.length === 0} onClick={() => pay("card")}>💳 Card</button>
          <button className="big-btn bg-sage text-[26px]" disabled={busy || lines.length === 0} onClick={() => pay("cash")}>💵 Cash</button>
        </div>
        {flash && <p className="pop-in text-center text-[24px] font-bold">{flash}</p>}
      </aside>
    </main>
  );
}
