"use client";
// Lane 4. Orders Nonna has prepared. Grandma looks, then says yes or no. Nothing is bought without her tap.
import { useState } from "react";
import type { IngredientStatus, Reorder, Supplier } from "@/lib/types";
import { amount, ingredientEmoji, money } from "@/components/format";
import { Confetti, Confirm, GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
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
  const [flash, setFlash] = useState<{ text: string; party?: boolean; sad?: boolean } | null>(null);
  const [stopping, setStopping] = useState<Reorder | null>(null);

  const ingredient = (id: string) =>
    inventory.status === "ok" ? inventory.data.find((s) => s.ingredient.id === id)?.ingredient : undefined;
  const supplier = (id: string) => (suppliers.status === "ok" ? suppliers.data.find((s) => s.id === id) : undefined);
  const nameOf = (r: Reorder) => ingredient(r.ingredientId)?.name ?? "this";

  function show(text: string, opts: { party?: boolean; sad?: boolean } = {}) {
    setFlash({ text, ...opts });
    setTimeout(() => setFlash(null), 8000);
  }

  async function act(r: Reorder, action: "approve" | "cancel") {
    setBusy(r.id);
    const res = await send<{ declined?: string }>(`/api/reorders/${r.id}/${action}`);
    setBusy(null);
    setStopping(null);
    if (res.ok) {
      const what = nameOf(r).toLowerCase();
      show(action === "approve" ? `Done! The ${what} is ordered. 🎉` : r.status === "placed" ? `Stopped! The money for the ${what} goes back on the card.` : `Okay, I won't buy the ${what}.`, {
        party: action === "approve",
      });
    } else if (res.status === 402) {
      const who = supplier(r.supplierId)?.name ?? "That supplier";
      show(res.data.declined === "over_limit" ? `${who}'s card is full for this week. Ask your grandson to raise it.` : `${who}'s card is switched off right now.`, { sad: true });
    } else {
      show("Hmm, that didn't work. Try once more?", { sad: true });
    }
    reorders.reload();
  }

  if (reorders.status === "loading") return <GrannyPage title="Orders to check" emoji="📦"><Loading /></GrannyPage>;
  if (reorders.status !== "ok") {
    return <GrannyPage title="Orders to check" emoji="📦"><StillCooking what="Your orders" error={reorders.status === "error"} /></GrannyPage>;
  }

  const waiting = reorders.data.filter((r) => r.status === "proposed");
  const onTheWay = reorders.data.filter((r) => r.status === "placed");

  return (
    <GrannyPage title="Orders to check" emoji="📦">
      {flash?.party && <Confetti />}
      {flash ? (
        <div className="pop-in"><NonnaSays mood={flash.sad ? "worried" : "proud"}>{flash.text}</NonnaSays></div>
      ) : (
        <NonnaSays mood={waiting.length ? "happy" : "proud"}>
          {waiting.length === 0
            ? "Nothing to check right now. I'll tell you when we need something!"
            : waiting.length === 1
              ? "I got one order ready. Have a look and tell me yes or no."
              : `I got ${waiting.length} orders ready. Have a look and tell me yes or no.`}
        </NonnaSays>
      )}

      <div className="flex flex-col gap-6">
        {waiting.map((r) => {
          const ing = ingredient(r.ingredientId);
          const sup = supplier(r.supplierId);
          return (
            <article key={r.id} className="toon pop-in grid gap-5 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <span aria-hidden className="text-[96px] leading-none">{ingredientEmoji(ing?.name ?? "")}</span>
              <div className="flex flex-col gap-1">
                <h2 className="text-[38px] font-bold leading-tight">
                  {ing ? amount(r.qty, ing.unit) : r.qty} {ing && ing.unit !== "pcs" ? "of " : ""}{ing?.name.toLowerCase() ?? "…"}
                </h2>
                <div className="text-[26px] font-semibold">from {sup?.name ?? "…"} {sup?.isLocal && <span title="Local farm">🌻 local</span>}</div>
                <div className="text-[22px] text-cocoa-soft">💡 {WHY[r.reason]} · {sup ? arrives(sup.leadTimeHours) : ""}</div>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:items-end">
                <div className="font-display text-center text-[52px] font-bold leading-none sm:text-right">{money(r.costCents)}</div>
                <button className="big-btn bg-sage" disabled={busy === r.id} onClick={() => act(r, "approve")}>
                  <span aria-hidden>✅</span> Yes, order it
                </button>
                <button className="big-btn bg-white text-[24px]" disabled={busy === r.id} onClick={() => act(r, "cancel")}>
                  <span aria-hidden>✋</span> No thanks
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {onTheWay.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[34px] font-bold">🚚 On the way</h2>
          {onTheWay.map((r) => {
            const ing = ingredient(r.ingredientId);
            return (
              <div key={r.id} className="toon flex flex-wrap items-center gap-4 bg-white px-6 py-4">
                <span aria-hidden className="text-5xl">{ingredientEmoji(ing?.name ?? "")}</span>
                <div className="flex-1">
                  <div className="text-[26px] font-bold">
                    {ing ? amount(r.qty, ing.unit) : r.qty} {ing && ing.unit !== "pcs" ? "of " : ""}{ing?.name.toLowerCase() ?? "…"} · {money(r.costCents)}
                  </div>
                  <div className="text-[20px] text-cocoa-soft">
                    {r.autoApproved ? "Nonna ordered this one by herself (it's a usual one)" : "You said yes"} · from {supplier(r.supplierId)?.name ?? "…"}
                  </div>
                </div>
                <button className="big-btn min-h-[60px] bg-white text-[22px]" onClick={() => setStopping(r)}>
                  Stop this order
                </button>
              </div>
            );
          })}
        </section>
      )}

      {stopping && (
        <Confirm
          emoji="✋"
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
