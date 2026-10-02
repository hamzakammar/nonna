"use client";
// Lane 4. Today's baking: Lane 3's make-list (morning batch + orders the shelf couldn't fill).
// Grandma ticks lines off, and can add an order someone phoned in (the university, a birthday…).
import { useState } from "react";
import type { PrepTask } from "@/lib/types";
import type { MenuItem } from "@/lib/catalog/types";
import { Confetti, GrannyPage, Loading, StillCooking } from "@/components/GrannyPage";
import { NonnaSays } from "@/components/Nonna";
import { send, useApi } from "@/components/useApi";

function Task({ t, onTick, busy }: { t: PrepTask; onTick: (t: PrepTask, done: boolean) => void; busy: boolean }) {
  const done = Boolean(t.doneAt);
  return (
    <li className={`toon flex flex-wrap items-center gap-5 p-5 ${done ? "bg-[#eef6f0] opacity-75" : ""}`}>
      <span aria-hidden className="text-[72px] leading-none">{t.emoji}</span>
      <div className="flex-1">
        <div className={`font-display text-[36px] font-bold leading-tight ${done ? "line-through" : ""}`}>
          {t.qty} × {t.name}
        </div>
        <div className="text-[20px] font-semibold text-cocoa-soft">{t.note}</div>
      </div>
      {done ? (
        <button className="big-btn min-h-[60px] bg-white text-[22px]" disabled={busy} onClick={() => onTick(t, false)}>
          ↩️ Not done yet
        </button>
      ) : (
        <button className="big-btn bg-sage" disabled={busy} onClick={() => onTick(t, true)}>
          <span aria-hidden>✅</span> Done!
        </button>
      )}
    </li>
  );
}

function AddOrder({ onDone }: { onDone: (msg: string) => void }) {
  const menu = useApi<MenuItem[]>("/api/menu");
  const [pick, setPick] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(12);
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!pick) return;
    setBusy(true);
    const res = await send("/api/sales/todo", { body: { productId: pick.id, qty, note: who.trim() ? `order for ${who.trim()}` : "order by phone" } });
    setBusy(false);
    onDone(res.ok ? `Added ${qty} × ${pick.name} to your list.` : "Hmm, that didn't save. Try once more?");
  }

  return (
    <section className="toon pop-in flex flex-col gap-6 p-7">
      <h2 className="text-[38px] font-bold">What did they order?</h2>
      {menu.status === "ok" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {menu.data.map((m) => (
            <button key={m.id} type="button" aria-pressed={pick?.id === m.id} className="tile text-[22px]" onClick={() => setPick(m)}>
              <span className="text-5xl">{m.emoji}</span> {m.name}
            </button>
          ))}
        </div>
      ) : (
        <StillCooking what="Your menu" error={menu.status === "error"} />
      )}
      {pick && (
        <>
          <h2 className="text-[38px] font-bold">How many {pick.name}?</h2>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="big-btn w-[84px] bg-white text-[40px]" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span className="font-display w-[120px] text-center text-[60px] font-bold">{qty}</span>
            <button type="button" className="big-btn w-[84px] bg-white text-[40px]" aria-label="More" onClick={() => setQty((q) => q + 1)}>+</button>
            {[6, 12, 24, 50].map((n) => (
              <button key={n} type="button" className="tile min-w-[90px] text-[26px]" onClick={() => setQty(n)}>{n}</button>
            ))}
          </div>
          <label className="flex flex-col gap-2 text-[26px] font-bold">
            Who is it for? <span className="text-[20px] font-semibold text-cocoa-soft">(you can skip this)</span>
            <input className="toon-input text-[32px]" placeholder="The university" value={who} onChange={(e) => setWho(e.target.value)} />
          </label>
          <button type="button" className="big-btn self-start bg-sage" disabled={busy} onClick={save}>
            <span aria-hidden>📝</span> Add it to my list
          </button>
        </>
      )}
    </section>
  );
}

export default function Bake() {
  const tasks = useApi<PrepTask[]>("/api/sales/todo", { pollMs: 5000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState<{ text: string; party?: boolean } | null>(null);

  function show(text: string, party = false) {
    setFlash({ text, party });
    setTimeout(() => setFlash(null), 8000);
  }

  async function tick(t: PrepTask, done: boolean) {
    setBusy(t.id);
    const res = await send(`/api/sales/todo/${t.id}`, { body: { done } });
    setBusy(null);
    if (!res.ok) show("Hmm, that didn't work. Try once more?");
    else if (done) {
      const left = tasks.status === "ok" ? tasks.data.filter((x) => !x.doneAt && x.id !== t.id).length : 1;
      show(left === 0 ? "That's everything for today. Brava! 🎉" : `Lovely! ${left} more to go.`, left === 0);
    }
    tasks.reload();
  }

  if (tasks.status === "loading") return <GrannyPage title="Today's baking" emoji="👩‍🍳"><Loading /></GrannyPage>;
  if (tasks.status !== "ok") {
    return <GrannyPage title="Today's baking" emoji="👩‍🍳"><StillCooking what="Today's baking list" error={tasks.status === "error"} /></GrannyPage>;
  }

  const todo = tasks.data.filter((t) => !t.doneAt);
  const orders = tasks.data.filter((t) => t.kind === "order");
  const morning = tasks.data.filter((t) => t.kind === "morning");

  return (
    <GrannyPage title="Today's baking" emoji="👩‍🍳">
      {flash?.party && <Confetti />}
      <div className="flex flex-wrap items-center justify-between gap-5">
        <NonnaSays mood={todo.length ? "happy" : "proud"}>
          {flash?.text ?? (todo.length === 0 ? "Nothing left to bake today. Put your feet up!" : `${todo.length} ${todo.length === 1 ? "thing" : "things"} to bake today.`)}
        </NonnaSays>
        {!adding && (
          <button className="big-btn bg-white" onClick={() => setAdding(true)}>
            <span aria-hidden>📞</span> Someone ordered
          </button>
        )}
      </div>

      {adding && <AddOrder onDone={(msg) => { setAdding(false); show(msg); tasks.reload(); }} />}

      {orders.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[34px] font-bold">📞 Orders</h2>
          <ul className="flex flex-col gap-4">
            {orders.map((t) => <Task key={t.id} t={t} busy={busy === t.id} onTick={tick} />)}
          </ul>
        </section>
      )}
      {morning.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[34px] font-bold">☀️ For the shelf this morning</h2>
          <ul className="flex flex-col gap-4">
            {morning.map((t) => <Task key={t.id} t={t} busy={busy === t.id} onTick={tick} />)}
          </ul>
        </section>
      )}
    </GrannyPage>
  );
}
