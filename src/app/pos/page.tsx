"use client";
// Lane 4 (UI) + Lane 3 (POST /api/sales). The mock till (design/till.html), standing in for Grandma's standalone Verifone.
// Every sale here eats stock through the recipes (Lane 1) and feeds the analytics (Lane 3).
import { useState } from "react";
import type { PaymentMethod } from "@/lib/types";
import type { MenuItem } from "@/lib/catalog/types";
import { money } from "@/components/format";
import { Loading, StillCooking } from "@/components/GrannyPage";
import { Icon } from "@/components/icons";
import { send, useApi } from "@/components/useApi";

const CATEGORY_DOT: Record<MenuItem["category"], string> = {
  parfait: "#c8642c",
  pie: "#8a3324",
  pastry: "#d9a441",
  drink: "#6b4a2f",
  other: "#6b7a4a",
};

const roundBtn = "flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-taupe bg-paper";

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
      setFlash(`Paid ${money(res.data.totalCents)} by ${paymentMethod}. Grazie!`);
    } else {
      setFlash(res.status === 501 ? "The till isn't connected yet." : (res.data.error ?? "That sale didn't go through."));
    }
    setTimeout(() => setFlash(null), 4000);
  }

  return (
    <main className="mx-auto flex w-[1194px] max-w-full flex-1 flex-col gap-6 px-14 pb-10 pt-[30px]">
      <header className="flex flex-col gap-1.5">
        <div className="text-[20px] font-extrabold uppercase tracking-[0.14em] text-rust">Nonna&apos;s bakery</div>
        <h1 className="m-0 text-[50px] leading-[1.05]">Till</h1>
      </header>

      <div className="flex flex-1 items-start gap-7">
        <div className="grid flex-1 grid-cols-3 gap-4">
          {menu.status === "loading" && <Loading />}
          {(menu.status === "cooking" || menu.status === "error") && <StillCooking what="The menu" error={menu.status === "error"} />}
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => add(m.id, 1)}
              className="relative flex min-h-[150px] flex-col items-start justify-between gap-2 rounded-[20px] border-[1.5px] border-linen bg-card px-[22px] py-5 text-left shadow-[0_3px_0_var(--linen-shadow)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: CATEGORY_DOT[m.category] }} />
                <span className="text-[17px] font-extrabold uppercase tracking-[0.08em] text-ink-soft">{m.category}</span>
              </div>
              <div className="font-display pr-12 text-[28px] leading-[1.1]">{m.name}</div>
              <div className="text-[26px] font-extrabold text-rust">{money(m.priceCents)}</div>
              {cart[m.id] && (
                <span className="font-display pop-in absolute right-3.5 top-3.5 flex h-11 min-w-11 items-center justify-center rounded-full bg-wine px-2.5 text-[24px] text-card">
                  {cart[m.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <aside className="toon sticky top-6 flex min-h-[560px] w-[360px] shrink-0 flex-col gap-[18px] px-[26px] pb-7 pt-[26px]">
          <h2 className="m-0 text-[32px]">This sale</h2>
          <div className="flex flex-col gap-3.5 border-b-[3px] border-dotted border-[#c9ad84] pb-[18px]">
            {lines.length === 0 && <p className="m-0 text-[20px] font-semibold text-ink-soft">Tap a treat to add it.</p>}
            {lines.map(({ item, qty }) => (
              <div key={item.id} className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3 text-[24px] font-extrabold">
                  <div>{item.name}</div>
                  <div>{money(item.priceCents * qty)}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[20px] font-semibold text-ink-soft">{qty} × {money(item.priceCents)}</div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={`One less ${item.name}`} className={roundBtn} onClick={() => add(item.id, -1)}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
                    </button>
                    <button type="button" aria-label={`One more ${item.name}`} className={roundBtn} onClick={() => add(item.id, 1)}>
                      <Icon name="plus" size={22} stroke={2.4} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[24px] font-extrabold">Total</div>
            <div className="font-display text-[52px] leading-none">{money(total)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="big-btn btn-primary min-h-[84px] rounded-[20px] px-0" disabled={busy || lines.length === 0} onClick={() => pay("card")}>
              <Icon name="card" size={30} /> Card
            </button>
            <button className="big-btn btn-go min-h-[84px] rounded-[20px] px-0" disabled={busy || lines.length === 0} onClick={() => pay("cash")}>
              <Icon name="cash" size={30} /> Cash
            </button>
          </div>
          {flash ? (
            <p className="pop-in m-0 text-center text-[20px] font-extrabold">{flash}</p>
          ) : (
            <button type="button" className="min-h-12 self-center text-[20px] font-extrabold text-ink-soft underline disabled:opacity-40" disabled={lines.length === 0} onClick={() => setCart({})}>
              Clear this sale
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
