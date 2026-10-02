"use client";
// Lane 4. Orders Nonna has prepared (design/orders.html). Grandma looks, then says yes or no. Nothing is bought without her tap.
import { useState } from "react";
import type { IngredientStatus, Reorder, Supplier } from "@/lib/types";
import { amount, money } from "@/components/format";
import { Confetti, Confirm, GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { Icon, IconDot, ingredientIcon } from "@/components/icons";
import { send, useApi } from "@/components/useApi";

const WHY: Record<Reorder["reason"], string> = {
  low_stock: "You're running low",
  expired: "Some went off",
  forecast: "You'll run out before it could arrive",
  manual: "You'll need it for your treats",
};

function arrives(hours: number) {
  if (hours <= 24) return hours <= 12 ? "Arrives by tonight or tomorrow morning" : "Arrives tomorrow";
  return `Arrives in about ${Math.round(hours / 24)} days`;
}

export default function Orders() {
  const reorders = useApi<Reorder[]>("/api/reorders", { pollMs: 5000 });
  const inventory = useApi<IngredientStatus[]>("/api/inventory");
  const suppliers = useApi<Supplier[]>("/api/suppliers");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; party?: boolean } | null>(null);
  const [stopping, setStopping] = useState<Reorder | null>(null);

  const ingredient = (id: string) =>
    inventory.status === "ok" ? inventory.data.find((s) => s.ingredient.id === id)?.ingredient : undefined;
  const supplier = (id: string) => (suppliers.status === "ok" ? suppliers.data.find((s) => s.id === id) : undefined);
  const nameOf = (r: Reorder) => ingredient(r.ingredientId)?.name ?? "this";
  const what = (r: Reorder) => {
    const ing = ingredient(r.ingredientId);
    if (!ing) return "…";
    return ing.unit === "pcs" ? `${amount(r.qty, ing.unit)} × ${ing.name.toLowerCase()}` : `${amount(r.qty, ing.unit)} of ${ing.name.toLowerCase()}`;
  };

  function show(text: string, party = false) {
    setFlash({ text, party });
    setTimeout(() => setFlash(null), 8000);
  }

  async function act(r: Reorder, action: "approve" | "cancel") {
    setBusy(r.id);
    const res = await send<{ declined?: string }>(`/api/reorders/${r.id}/${action}`);
    setBusy(null);
    setStopping(null);
    const name = nameOf(r).toLowerCase();
    if (res.ok) {
      show(action === "approve" ? `Done! The ${name} is ordered.` : r.status === "placed" ? `Stopped. The money for the ${name} goes back on the card.` : `Okay, I won't buy the ${name}.`, action === "approve");
    } else if (res.status === 402) {
      const who = supplier(r.supplierId)?.name ?? "That supplier";
      show(res.data.declined === "over_limit" ? `${who}'s card is full for this week. Ask your grandson to raise it.` : `${who}'s card is switched off right now.`);
    } else {
      show("Hmm, that didn't work. Try once more?");
    }
    reorders.reload();
  }

  if (reorders.status === "loading") return <GrannyPage title="Orders to check"><Loading /></GrannyPage>;
  if (reorders.status !== "ok") {
    return <GrannyPage title="Orders to check"><StillCooking what="Your orders" error={reorders.status === "error"} /></GrannyPage>;
  }

  const waiting = reorders.data.filter((r) => r.status === "proposed");
  const onTheWay = reorders.data.filter((r) => r.status === "placed");

  return (
    <GrannyPage title="Orders to check">
      {flash?.party && <Confetti />}
      <NonnaSays>
        {flash?.text ??
          (waiting.length === 0
            ? "Nothing to check right now. I'll tell you when we need something!"
            : waiting.length === 1
              ? "I got one order ready. Have a look and tell me yes or no."
              : `I got ${waiting.length} orders ready. Have a look and tell me yes or no.`)}
      </NonnaSays>

      {waiting.map((r) => {
        const ing = ingredient(r.ingredientId);
        const sup = supplier(r.supplierId);
        const icon = ingredientIcon(ing?.name ?? "");
        return (
          <article key={r.id} className="toon pop-in grid grid-cols-[auto_1fr_auto] items-center gap-7 px-8 py-[30px]">
            <IconDot name={icon.name} tint={icon.tint} size={120} />
            <div className="flex flex-col gap-1.5">
              <h2 className="m-0 text-[40px] leading-[1.1]">{what(r)}</h2>
              <div className="text-[28px] font-bold">
                from {sup?.name ?? "…"}{sup?.isLocal ? " · a local farm" : ""}
              </div>
              <div className="text-[23px] font-semibold text-ink-soft">
                {WHY[r.reason]}{sup ? ` · ${arrives(sup.leadTimeHours)}` : ""}
              </div>
            </div>
            <div className="flex w-[300px] flex-col gap-3.5">
              <div className="font-display text-right text-[56px] leading-none">{money(r.costCents)}</div>
              <button className="big-btn btn-go min-h-[80px]" disabled={busy === r.id} onClick={() => act(r, "approve")}>
                <Icon name="check" size={30} stroke={2.4} /> Yes, order it
              </button>
              <button className="big-btn min-h-[68px] shadow-none" disabled={busy === r.id} onClick={() => act(r, "cancel")}>
                No thanks
              </button>
            </div>
          </article>
        );
      })}

      {onTheWay.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="m-0 text-[34px]">On the way</h2>
          {onTheWay.map((r) => {
            const icon = ingredientIcon(nameOf(r));
            return (
              <div key={r.id} className="toon flex items-center gap-[22px] px-7 py-[22px]">
                <IconDot name={icon.name} tint={icon.tint} size={84} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="text-[28px] font-extrabold">{what(r)} · {money(r.costCents)}</div>
                  <div className="text-[22px] font-semibold text-ink-soft">
                    {r.autoApproved ? "Nonna ordered this one by herself (it's a usual one)" : "You said yes"} · from {supplier(r.supplierId)?.name ?? "…"}
                  </div>
                </div>
                <button className="big-btn min-h-[64px] shrink-0 text-[23px] shadow-none" onClick={() => setStopping(r)}>
                  Stop this order
                </button>
              </div>
            );
          })}
        </section>
      )}

      {stopping && (
        <Confirm
          question={`Stop the order of ${nameOf(stopping).toLowerCase()}? You get the money back.`}
          yes="Yes, stop it"
          no="No, keep it"
          busy={busy === stopping.id}
          onYes={() => act(stopping, "cancel")}
          onNo={() => setStopping(null)}
        />
      )}
    </GrannyPage>
  );
}
