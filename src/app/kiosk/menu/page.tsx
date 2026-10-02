"use client";
// Lane 4. Grandma's menu: every treat and what goes in it. Add one, or take one off.
import Link from "next/link";
import { useState } from "react";
import type { MenuItem } from "@/lib/catalog/types";
import { amount, ingredientEmoji, money } from "@/components/format";
import { Confirm, GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { send, useApi } from "@/components/useApi";

export default function Menu() {
  const menu = useApi<MenuItem[]>("/api/menu");
  const [removing, setRemoving] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function remove(item: MenuItem) {
    setBusy(true);
    const res = await send(`/api/menu/${item.id}`, { method: "DELETE" });
    setBusy(false);
    setRemoving(null);
    setFlash(res.ok ? `Okay! ${item.name} is off the menu.` : "Hmm, that didn't work. Try once more?");
    setTimeout(() => setFlash(null), 8000);
    menu.reload();
  }

  return (
    <GrannyPage title="My menu" emoji="🍰">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <NonnaSays mood="happy">{flash ?? "Here are all your treats."}</NonnaSays>
        <Link href="/kiosk/menu/new" className="big-btn bg-sage">
          <span aria-hidden>➕</span> Add a new treat
        </Link>
      </div>

      {menu.status === "loading" && <Loading />}
      {(menu.status === "cooking" || menu.status === "error") && <StillCooking what="Your menu" error={menu.status === "error"} />}
      {menu.status === "ok" && (
        <div className="grid gap-6 sm:grid-cols-2">
          {menu.data.map((item) => (
            <article key={item.id} className="toon flex flex-col gap-4 p-6">
              <div className="flex items-center gap-4">
                <span aria-hidden className="text-[80px] leading-none">{item.emoji}</span>
                <div>
                  <h2 className="text-[34px] font-bold leading-tight">{item.name}</h2>
                  <div className="font-display text-[30px] font-bold text-terracotta-deep">{money(item.priceCents)}</div>
                </div>
              </div>
              <ul className="flex flex-wrap gap-2">
                {item.recipe.map((r) => (
                  <li key={r.ingredientId} className="rounded-full border-[3px] border-cocoa bg-butter px-3 py-1 text-[18px] font-bold">
                    {ingredientEmoji(r.name)} {r.name} · {amount(r.qtyPerUnit, r.unit)}
                  </li>
                ))}
              </ul>
              <button className="big-btn mt-auto min-h-[64px] self-start bg-white text-[22px]" onClick={() => setRemoving(item)}>
                <span aria-hidden>🗑️</span> Take off the menu
              </button>
            </article>
          ))}
        </div>
      )}

      {removing && (
        <Confirm
          emoji={removing.emoji}
          question={`Take ${removing.name} off the menu?`}
          yes="Yes, take it off"
          no="No, keep it"
          busy={busy}
          onYes={() => remove(removing)}
          onNo={() => setRemoving(null)}
        />
      )}
    </GrannyPage>
  );
}
