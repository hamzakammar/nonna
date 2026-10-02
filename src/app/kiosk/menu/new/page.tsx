"use client";
// Lane 4. Add a new treat, one question per screen. The picture is picked from the name. New ingredients are added to the pantry and
// Nonna gets their first order ready for Grandma to approve.
import Link from "next/link";
import { useState } from "react";
import type { IngredientStatus, Supplier, Unit } from "@/lib/types";
import type { NewIngredientInput, NewMenuItemInput, NewMenuItemResult } from "@/lib/catalog/types";
import { amount, ingredientEmoji, money, treatEmoji, UNIT_WORDS } from "@/components/format";
import { Confetti, GrannyPage, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { send, useApi } from "@/components/useApi";

const PER_TREAT_CHIPS: Record<Unit, number[]> = { g: [10, 25, 50, 100, 150, 200], ml: [10, 20, 30, 50, 100, 200], pcs: [0.5, 1, 2, 3] };
const PACK_CHIPS: Record<Unit, number[]> = { g: [500, 1000, 2500, 5000], ml: [500, 1000, 2000, 4000], pcs: [12, 30, 50, 100] };
const FRESH = [
  { days: 3, label: "A few days", emoji: "🥀" },
  { days: 7, label: "About a week", emoji: "🗓️" },
  { days: 14, label: "Two weeks", emoji: "📆" },
  { days: 30, label: "A month", emoji: "🌙" },
  { days: 180, label: "Months and months", emoji: "🏺" },
];

type Line = { key: string; name: string; unit: Unit; qtyPerUnit: number; ingredientId?: string; newIngredient?: NewIngredientInput };
type Building = { name: string; unit?: Unit; ingredientId?: string; supplierId?: string; packSize?: number; packPrice?: string; shelfLifeDays?: number; qty?: number };

type Step =
  | "name" | "price" | "ingredients"
  | "pick" | "new-name" | "new-unit" | "new-supplier" | "new-pack" | "new-fresh" | "amount"
  | "check" | "done";

const MAIN: Step[] = ["name", "price", "ingredients", "check"];

const toCents = (dollars: string) => Math.round(Number(dollars.replace(/[^0-9.]/g, "")) * 100);

function Question({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[40px] font-bold leading-tight">{children}</h2>;
}

function NumberBox({ value, onChange, unitWord, step, placeholder }: { value: number | undefined; onChange: (n: number | undefined) => void; unitWord: string; step: number; placeholder?: string }) {
  const bump = (d: number) => onChange(Math.max(0, Math.round(((value ?? 0) + d) * 100) / 100));
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" className="big-btn w-[84px] bg-white text-[40px]" onClick={() => bump(-step)} aria-label="Less">−</button>
      <div className="flex items-center gap-3">
        <input
          className="toon-input w-[220px] text-center"
          inputMode="decimal"
          value={value ?? ""}
          placeholder={placeholder ?? "0"}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(e.target.value === "" || Number.isNaN(n) ? undefined : n);
          }}
        />
        <span className="font-display text-[34px] font-bold">{unitWord}</span>
      </div>
      <button type="button" className="big-btn w-[84px] bg-white text-[40px]" onClick={() => bump(step)} aria-label="More">+</button>
    </div>
  );
}

function Chips({ values, unit, onPick }: { values: number[]; unit: Unit; onPick: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {values.map((v) => (
        <button key={v} type="button" className="tile min-w-[110px] text-[24px]" onClick={() => onPick(v)}>
          {unit === "pcs" ? v : amount(v, unit)}
        </button>
      ))}
    </div>
  );
}

export default function NewTreat() {
  const inventory = useApi<IngredientStatus[]>("/api/inventory");
  const suppliers = useApi<Supplier[]>("/api/suppliers");

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [b, setB] = useState<Building>({ name: "" });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewMenuItemResult | null>(null);

  const emoji = treatEmoji(name);
  const existing = inventory.status === "ok" ? inventory.data.map((s) => s.ingredient) : [];
  const taken = new Set(lines.map((l) => l.ingredientId ?? `new:${l.name.toLowerCase()}`));
  const matches = existing.filter((i) => !taken.has(i.id) && i.name.toLowerCase().includes(search.trim().toLowerCase()));
  const nameClash = existing.find((i) => i.name.toLowerCase() === b.name.trim().toLowerCase());

  function startIngredient() {
    setB({ name: "" });
    setSearch("");
    setStep("pick");
  }

  function finishIngredient() {
    if (!b.unit || !b.qty) return;
    const line: Line = b.ingredientId
      ? { key: b.ingredientId, name: b.name, unit: b.unit, qtyPerUnit: b.qty, ingredientId: b.ingredientId }
      : {
          key: `new:${b.name}`,
          name: b.name.trim(),
          unit: b.unit,
          qtyPerUnit: b.qty,
          newIngredient: {
            name: b.name.trim(), unit: b.unit, supplierId: b.supplierId!, packSize: b.packSize!,
            packPriceCents: toCents(b.packPrice ?? ""), shelfLifeDays: b.shelfLifeDays!,
          },
        };
    setLines((ls) => [...ls, line]);
    setStep("ingredients");
  }

  async function save() {
    setSaving(true);
    setError(null);
    const body: NewMenuItemInput = {
      name: name.trim(),
      emoji,
      priceCents: toCents(price),
      ingredients: lines.map((l) => (l.newIngredient ? { newIngredient: l.newIngredient, qtyPerUnit: l.qtyPerUnit } : { ingredientId: l.ingredientId!, qtyPerUnit: l.qtyPerUnit })),
    };
    const res = await send<NewMenuItemResult>("/api/menu", { body });
    setSaving(false);
    if (res.ok) {
      setResult(res.data);
      setStep("done");
    } else {
      setError(res.status === 501 ? "Saving treats isn't ready yet." : (res.data.error ?? "That didn't save. Try once more?"));
    }
  }

  // ----- what "Next" does and whether it's allowed, per step -----
  const flow: Partial<Record<Step, { next?: () => void; ok?: boolean; back: () => void }>> = {
    name: { next: () => setStep("price"), ok: name.trim().length > 0, back: () => history.back() },
    price: { next: () => setStep("ingredients"), ok: toCents(price) > 0, back: () => setStep("name") },
    ingredients: { next: () => setStep("check"), ok: lines.length > 0, back: () => setStep("price") },
    pick: { back: () => setStep("ingredients") },
    "new-name": { next: () => setStep("new-unit"), ok: b.name.trim().length > 0 && !nameClash, back: () => setStep("pick") },
    "new-unit": { back: () => setStep("new-name") },
    "new-supplier": { back: () => setStep("new-unit") },
    "new-pack": { next: () => setStep("new-fresh"), ok: (b.packSize ?? 0) > 0 && toCents(b.packPrice ?? "") > 0, back: () => setStep("new-supplier") },
    "new-fresh": { back: () => setStep("new-pack") },
    amount: { next: finishIngredient, ok: (b.qty ?? 0) > 0, back: () => setStep(b.ingredientId ? "pick" : "new-fresh") },
    check: { back: () => setStep("ingredients") },
  };
  const nav = flow[step];
  const mainIndex = MAIN.indexOf(step);
  const stepNumber = mainIndex >= 0 ? mainIndex : MAIN.indexOf("ingredients");

  if (step === "done" && result) {
    const needOrders = result.orderedIngredients.filter((o) => o.reorderId);
    return (
      <GrannyPage title="All done!" emoji="🎉">
        <Confetti />
        <div className="toon pop-in flex flex-col items-center gap-6 p-10 text-center">
          <span className="bob text-[140px] leading-none">{result.item.emoji}</span>
          <h2 className="text-[48px] font-bold">{result.item.name} is on the menu!</h2>
          <p className="text-[26px] font-semibold">
            I&apos;ll keep track of every ingredient, and ask you before I buy more.
          </p>
          {needOrders.length > 0 && (
            <NonnaSays>
              You don&apos;t have any {needOrders.map((o) => o.name.toLowerCase()).join(" or ")} yet, so I got {needOrders.length === 1 ? "an order" : "orders"} ready for you.
            </NonnaSays>
          )}
          <div className="flex flex-wrap justify-center gap-4">
            {needOrders.length > 0 && <Link href="/kiosk/orders" className="big-btn bg-terracotta">📦 Check the order</Link>}
            <Link href="/kiosk/menu" className="big-btn bg-sage">🍰 See my menu</Link>
            <Link href="/kiosk" className="big-btn bg-white">🏠 Home</Link>
          </div>
        </div>
      </GrannyPage>
    );
  }

  return (
    <GrannyPage title="Add a new treat" emoji="➕">
      {/* where am I? five big dots */}
      <ol className="flex items-center gap-3" aria-label={`Step ${stepNumber + 1} of ${MAIN.length}`}>
        {MAIN.map((s, i) => (
          <li key={s} className={`h-6 rounded-full border-[3px] border-cocoa transition-all ${i < stepNumber ? "w-6 bg-sage" : i === stepNumber ? "w-14 bg-terracotta" : "w-6 bg-white"}`} />
        ))}
        <span className="ml-2 text-[22px] font-bold">Step {stepNumber + 1} of {MAIN.length}</span>
      </ol>

      <section key={step} className="toon pop-in flex flex-col gap-7 p-7 sm:p-9">
        {step === "name" && (
          <>
            <Question>What&apos;s the new treat called?</Question>
            <input autoFocus className="toon-input" placeholder="Pumpkin Tart" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep("price")} />
            {name.trim() && <div className="pop-in flex items-center gap-3 text-[26px] font-bold"><span className="text-[64px]">{emoji}</span> Looks yummy!</div>}
          </>
        )}

        {step === "price" && (
          <>
            <Question>How much does one {name.trim()} cost?</Question>
            <div className="flex items-center gap-3">
              <span className="font-display text-[60px] font-bold">$</span>
              <input autoFocus className="toon-input w-[260px] text-[56px]" inputMode="decimal" placeholder="6.50" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              {[300, 450, 550, 650, 750].map((c) => (
                <button key={c} type="button" className="tile text-[26px]" onClick={() => setPrice((c / 100).toFixed(2))}>{money(c)}</button>
              ))}
            </div>
          </>
        )}

        {step === "ingredients" && (
          <>
            <Question>What goes in one {name.trim()}?</Question>
            {lines.length === 0 && <p className="text-[24px] text-cocoa-soft">Nothing yet. Add the first ingredient!</p>}
            <ul className="flex flex-col gap-3">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-4 rounded-3xl border-4 border-cocoa bg-butter px-5 py-3">
                  <span aria-hidden className="text-5xl">{ingredientEmoji(l.name)}</span>
                  <span className="flex-1 text-[28px] font-bold">
                    {amount(l.qtyPerUnit, l.unit)} {l.unit === "pcs" ? "×" : "of"} {l.name.toLowerCase()}
                    {l.newIngredient && <span className="ml-2 rounded-full bg-sage px-3 py-0.5 text-[18px]">new!</span>}
                  </span>
                  <button type="button" className="big-btn min-h-[56px] bg-white text-[20px]" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="big-btn self-start bg-sage" onClick={startIngredient}>
              <span aria-hidden>➕</span> {lines.length ? "Add another ingredient" : "Add an ingredient"}
            </button>
          </>
        )}

        {step === "pick" && (
          <>
            <Question>Which ingredient?</Question>
            <input autoFocus className="toon-input text-[32px]" placeholder="🔎 Type to find it…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {inventory.status === "cooking" || inventory.status === "error" ? (
              <StillCooking what="Your pantry list" error={inventory.status === "error"} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button type="button" className="tile bg-butter-deep text-[22px]" onClick={() => { setB({ name: search.trim() }); setStep("new-name"); }}>
                  <span className="text-5xl">✨</span> Something new
                </button>
                {matches.map((i) => (
                  <button key={i.id} type="button" className="tile text-[22px]" onClick={() => { setB({ name: i.name, unit: i.unit, ingredientId: i.id }); setStep("amount"); }}>
                    <span className="text-5xl">{ingredientEmoji(i.name)}</span> {i.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === "new-name" && (
          <>
            <Question>What&apos;s the new ingredient called?</Question>
            <input autoFocus className="toon-input" placeholder="Cinnamon" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
            {nameClash && (
              <p className="text-[24px] font-bold text-terracotta-deep">
                You already have {nameClash.name}!{" "}
                <button type="button" className="underline" onClick={() => { setB({ name: nameClash.name, unit: nameClash.unit, ingredientId: nameClash.id }); setStep("amount"); }}>
                  Use that one
                </button>
              </p>
            )}
          </>
        )}

        {step === "new-unit" && (
          <>
            <Question>How do you measure {b.name.trim().toLowerCase()}?</Question>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["g", "ml", "pcs"] as Unit[]).map((u) => (
                <button key={u} type="button" aria-pressed={b.unit === u} className="tile py-6 text-[30px]" onClick={() => { setB({ ...b, unit: u }); setStep("new-supplier"); }}>
                  <span className="text-6xl">{UNIT_WORDS[u].emoji}</span>
                  {UNIT_WORDS[u].verb}
                  <span className="text-[20px] text-cocoa-soft">in {UNIT_WORDS[u].word}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "new-supplier" && (
          <>
            <Question>Who sells you {b.name.trim().toLowerCase()}?</Question>
            {suppliers.status !== "ok" ? (
              <StillCooking what="Your suppliers" error={suppliers.status === "error"} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {suppliers.data.map((s) => (
                  <button key={s.id} type="button" aria-pressed={b.supplierId === s.id} className="tile flex-row justify-start gap-4 px-5 text-left text-[26px]" onClick={() => { setB({ ...b, supplierId: s.id }); setStep("new-pack"); }}>
                    <span className="text-5xl">{s.isLocal ? "🌻" : "🚚"}</span>
                    <span>
                      {s.name}
                      <span className="block text-[18px] text-cocoa-soft">{s.isLocal ? "Local" : "Delivers"} · arrives in {s.leadTimeHours <= 24 ? `${s.leadTimeHours} hours` : `${Math.round(s.leadTimeHours / 24)} days`}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === "new-pack" && b.unit && (
          <>
            <Question>When you buy {b.name.trim().toLowerCase()}, how big is one pack?</Question>
            <NumberBox value={b.packSize} onChange={(n) => setB({ ...b, packSize: n })} unitWord={UNIT_WORDS[b.unit].word} step={b.unit === "pcs" ? 6 : 100} />
            <Chips values={PACK_CHIPS[b.unit]} unit={b.unit} onPick={(n) => setB({ ...b, packSize: n })} />
            <Question>And what does that pack cost?</Question>
            <div className="flex items-center gap-3">
              <span className="font-display text-[56px] font-bold">$</span>
              <input className="toon-input w-[240px] text-[48px]" inputMode="decimal" placeholder="8.00" value={b.packPrice ?? ""} onChange={(e) => setB({ ...b, packPrice: e.target.value })} />
            </div>
          </>
        )}

        {step === "new-fresh" && (
          <>
            <Question>How long does {b.name.trim().toLowerCase()} stay fresh?</Question>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {FRESH.map((f) => (
                <button key={f.days} type="button" aria-pressed={b.shelfLifeDays === f.days} className="tile py-5 text-[22px]" onClick={() => { setB({ ...b, shelfLifeDays: f.days }); setStep("amount"); }}>
                  <span className="text-5xl">{f.emoji}</span> {f.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "amount" && b.unit && (
          <>
            <Question>How much {b.name.toLowerCase()} goes in one {name.trim()}?</Question>
            <NumberBox value={b.qty} onChange={(n) => setB({ ...b, qty: n })} unitWord={UNIT_WORDS[b.unit].word} step={b.unit === "pcs" ? 0.5 : 5} />
            <Chips values={PER_TREAT_CHIPS[b.unit]} unit={b.unit} onPick={(n) => setB({ ...b, qty: n })} />
          </>
        )}

        {step === "check" && (
          <>
            <Question>Does this look right?</Question>
            <div className="flex items-center gap-5 rounded-3xl border-4 border-cocoa bg-butter p-6">
              <span className="text-[100px] leading-none">{emoji}</span>
              <div>
                <div className="font-display text-[44px] font-bold leading-tight">{name.trim()}</div>
                <div className="font-display text-[36px] font-bold text-terracotta-deep">{money(toCents(price))}</div>
              </div>
            </div>
            <ul className="flex flex-col gap-2 text-[26px] font-bold">
              {lines.map((l) => (
                <li key={l.key}>{ingredientEmoji(l.name)} {amount(l.qtyPerUnit, l.unit)} {l.unit === "pcs" ? "×" : "of"} {l.name.toLowerCase()}{l.newIngredient ? " (new)" : ""}</li>
              ))}
            </ul>
            {error && <p className="text-[24px] font-bold text-terracotta-deep">😳 {error}</p>}
            <button type="button" className="big-btn self-center bg-sage px-10 text-[34px]" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Put it on the menu! 🎉"}
            </button>
          </>
        )}
      </section>

      {nav && (
        <div className="flex justify-between gap-4">
          <button type="button" className="big-btn bg-white" onClick={nav.back}>⬅ Back</button>
          {nav.next && (
            <button type="button" className="big-btn bg-terracotta" disabled={!nav.ok} onClick={nav.next}>
              {step === "amount" ? "Add it ✔" : "Next ➡"}
            </button>
          )}
        </div>
      )}
    </GrannyPage>
  );
}
