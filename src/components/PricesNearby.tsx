"use client";
// "Prices nearby": Lane 1's Price Watch advice in Grandma's words, in the shop page's card style.
// Changing a price always asks first.
import { useState } from "react";
import type { PriceAdvice } from "@/lib/types";
import { money } from "./format";
import { Confirm, Loading, StillCooking } from "./GrannyPage";
import { Icon } from "./icons";
import { send, useApi } from "./useApi";

const SAY: Record<PriceAdvice["action"], (a: PriceAdvice) => string> = {
  undercut: () => "You could go a little cheaper than them and still earn well.",
  raise: (a) => `You're much cheaper than ${a.competitorName}. You can charge a bit more and still be the better deal.`,
  hold: () => "Your price is just right. Leave it!",
  cant_undercut: (a) => `Going cheaper than ${a.competitorName} would lose money. Make yours the best instead!`,
};

export function PricesNearby({ onChanged }: { onChanged?: () => void }) {
  const watch = useApi<{ advice: PriceAdvice[] }>("/api/pricewatch");
  const [asking, setAsking] = useState<PriceAdvice | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function apply(a: PriceAdvice) {
    if (!a.suggestedPriceCents) return;
    setBusy(true);
    const res = await send("/api/pricewatch/apply", { body: { productId: a.productId, priceCents: a.suggestedPriceCents } });
    setBusy(false);
    setAsking(null);
    setFlash(res.ok ? `Done! ${a.name} is now ${money(a.suggestedPriceCents)}.` : "Hmm, that price didn't save.");
    setTimeout(() => setFlash(null), 8000);
    watch.reload();
    onChanged?.();
  }

  return (
    <section className="toon flex flex-col gap-[22px] px-8 pb-8 pt-[30px]">
      <h2 className="m-0 text-[36px]">Prices nearby</h2>
      {flash && <p className="pop-in m-0 rounded-[14px] bg-tint-olive px-[18px] py-3 text-[23px] font-extrabold">{flash}</p>}
      {watch.status === "loading" && <Loading />}
      {(watch.status === "cooking" || watch.status === "error") && <StillCooking what="Other bakeries' prices" error={watch.status === "error"} />}
      {watch.status === "ok" &&
        (watch.data.advice.length === 0 ? (
          <p className="m-0 text-[24px] font-semibold">I haven&apos;t seen any other bakeries&apos; prices yet.</p>
        ) : (
          watch.data.advice.map((a) => (
            <article key={`${a.productId}-${a.competitorId}`} className="flex flex-col gap-3.5 rounded-[18px] border-[1.5px] border-linen bg-paper px-6 py-[22px]">
              <h3 className="m-0 text-[30px]">{a.name}</h3>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex items-center gap-3.5 rounded-[14px] border-[1.5px] border-linen bg-card px-[18px] py-3">
                  <Icon name="store" size={32} className="shrink-0 text-ink-soft" />
                  <div>
                    <div className="text-[21px] font-extrabold">{a.competitorName}</div>
                    <div className="text-[18px] font-semibold text-ink-soft">&ldquo;{a.theirItemName}&rdquo;</div>
                  </div>
                  <div className="font-display ml-auto text-[32px]">{money(a.theirPriceCents)}</div>
                </div>
                <div className="flex items-center gap-3.5 rounded-[14px] border-[1.5px] border-linen bg-card px-[18px] py-3">
                  <Icon name="home" size={32} className="shrink-0 text-rust" />
                  <div className="text-[21px] font-extrabold">You</div>
                  <div className="font-display ml-auto text-[32px] text-rust">{money(a.ourPriceCents)}</div>
                </div>
              </div>
              <div className="text-[23px] font-extrabold"><span className="text-rust">Nonna says:</span> {SAY[a.action](a)}</div>
              {a.suggestedPriceCents && (a.action === "undercut" || a.action === "raise") && (
                <button className="big-btn btn-go self-start text-[26px]" onClick={() => setAsking(a)}>
                  <Icon name="tag" size={28} /> Change mine to {money(a.suggestedPriceCents)}
                </button>
              )}
            </article>
          ))
        ))}
      {asking?.suggestedPriceCents && (
        <Confirm
          question={`Change ${asking.name} from ${money(asking.ourPriceCents)} to ${money(asking.suggestedPriceCents)}?`}
          yes="Yes, change it"
          no="No, keep it"
          busy={busy}
          onYes={() => apply(asking)}
          onNo={() => setAsking(null)}
        />
      )}
    </section>
  );
}
