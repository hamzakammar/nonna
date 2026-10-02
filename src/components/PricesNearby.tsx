"use client";
// "Prices nearby": Lane 1's Price Watch advice in Grandma's words. Changing a price always asks first.
import { useState } from "react";
import type { PriceAdvice } from "@/lib/types";
import { money } from "./format";
import { Confirm, Loading, StillCooking } from "./GrannyPage";
import { send, useApi } from "./useApi";

const SAY: Record<PriceAdvice["action"], (a: PriceAdvice) => string> = {
  undercut: () => `You could go a little cheaper than them and still earn well.`,
  raise: (a) => `You're much cheaper than ${a.competitorName}. You can charge a bit more and still be the better deal.`,
  hold: () => `Your price is just right. Leave it! 👍`,
  cant_undercut: (a) => `Going cheaper than ${a.competitorName} would lose money. Make yours the best instead!`,
};

export function PricesNearby({ emojiOf, onChanged }: { emojiOf: (productId: string) => string; onChanged?: () => void }) {
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
    <section className="toon flex flex-col gap-5 p-6 sm:p-8">
      <h2 className="flex items-center gap-3 text-[36px] font-bold"><span aria-hidden>🏪</span>Prices nearby</h2>
      {flash && <p className="pop-in rounded-2xl border-[3px] border-cocoa bg-sage px-4 py-2 text-[24px] font-bold">{flash}</p>}
      {watch.status === "loading" && <Loading />}
      {(watch.status === "cooking" || watch.status === "error") && <StillCooking what="Other bakeries' prices" error={watch.status === "error"} />}
      {watch.status === "ok" &&
        (watch.data.advice.length === 0 ? (
          <p className="text-[24px]">I haven&apos;t seen any other bakeries&apos; prices yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {watch.data.advice.map((a) => (
              <article key={`${a.productId}-${a.competitorId}`} className="flex flex-col gap-3 rounded-3xl border-4 border-cocoa bg-butter p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <span aria-hidden className="text-[60px] leading-none">{emojiOf(a.productId)}</span>
                  <h3 className="flex-1 text-[30px] font-bold">{a.name}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border-[3px] border-cocoa bg-white px-4 py-3 text-[22px] font-bold">
                    🏪 {a.competitorName}: <span className="font-display text-[30px]">{money(a.theirPriceCents)}</span>
                    <div className="text-[18px] font-semibold text-cocoa-soft">&ldquo;{a.theirItemName}&rdquo;</div>
                  </div>
                  <div className="rounded-2xl border-[3px] border-cocoa bg-white px-4 py-3 text-[22px] font-bold">
                    👵 You: <span className="font-display text-[30px]">{money(a.ourPriceCents)}</span>
                  </div>
                </div>
                <p className="text-[22px] font-semibold">💡 {SAY[a.action](a)}</p>
                {a.suggestedPriceCents && (a.action === "undercut" || a.action === "raise") && (
                  <button className="big-btn self-start bg-sage text-[26px]" onClick={() => setAsking(a)}>
                    <span aria-hidden>🏷️</span> Change mine to {money(a.suggestedPriceCents)}
                  </button>
                )}
              </article>
            ))}
          </div>
        ))}
      {asking?.suggestedPriceCents && (
        <Confirm
          emoji="🏷️"
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
