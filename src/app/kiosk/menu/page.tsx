"use client";
// Lane 4. Grandma's menu (design/menu.html): every treat and what goes in it. Add one, or take one off.
import Link from "next/link";
import { useState } from "react";
import type { MenuItem } from "@/lib/catalog/types";
import { amount, money } from "@/components/format";
import { Confirm, GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { Icon } from "@/components/icons";
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
    <GrannyPage
      title="My menu"
      action={
        <Link href="/kiosk/menu/new" className="big-btn btn-primary min-h-[72px] px-[34px] text-[28px]">
          <Icon name="plus" size={28} stroke={2.2} /> Add a new treat
        </Link>
      }
    >
      <NonnaSays>{flash ?? "Here are all your treats."}</NonnaSays>

      {menu.status === "loading" && <Loading />}
      {(menu.status === "cooking" || menu.status === "error") && <StillCooking what="Your menu" error={menu.status === "error"} />}
      {menu.status === "ok" && (
        <div className="grid grid-cols-2 gap-6">
          {menu.data.map((item) => (
            <article key={item.id} className="toon flex flex-col gap-[18px] px-7 py-[26px]">
              <div className="flex items-baseline gap-3">
                <h2 className="m-0 text-[32px] leading-[1.1]">{item.name}</h2>
                <div aria-hidden className="min-w-5 flex-1 border-b-[3px] border-dotted border-[#c9ad84]" />
                <div className="font-display text-[32px] text-rust">{money(item.priceCents)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.recipe.map((r) => (
                  <div key={r.ingredientId} className="rounded-full border-[1.5px] border-linen bg-paper px-3.5 py-[5px] text-[19px] font-bold">
                    {r.name} · {amount(r.qtyPerUnit, r.unit)}
                  </div>
                ))}
              </div>
              <button className="big-btn mt-auto min-h-[60px] self-start px-6 text-[22px] shadow-none" onClick={() => setRemoving(item)}>
                Take off the menu
              </button>
            </article>
          ))}
        </div>
      )}

      {removing && (
        <Confirm
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
