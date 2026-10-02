# Design Philosophy

Read this before writing any code. When two good options conflict, these rules decide. They're in priority order.

## The one-sentence version

> **Grandma never learns software. The software learns Grandma.**

Everything Grandma does with Nonna.exe takes **one spoken sentence or a "yes"**. If a feature needs her to look at a screen, tap through a menu or remember a command, it's for the grandson's dashboard, not for her.

---

## The 8 rules

### 1. Voice in, voice out, zero thought
- Grandma talks to the bakery the way she'd talk to a helper: *"Nonna, how's the cream?"*, *"Yes, order it."*, *"Remind me later."*
- **No command syntax.** "Order cream", "get more cream", "we need cream" and "cream, please" all work.
- When Nonna has asked a question, Grandma **doesn't need the wake word** for the answer. She just says "yes".
- Every voice interaction has a **big-button fallback** on the kiosk (YES / NO / TAP & TALK) for when the bakery is loud.

### 2. Nonna is funny. The numbers are not.
- **Code computes, the LLM phrases.** Every quantity, price, date, product and supplier Nonna says comes from our database or functions, never from the model.
- The LLM picks *which tool to call* and *how to say the result*. It never decides *what the result is*.
- When persona text is generated, the factual `text` is the source of truth. If the styled version is wrong, slow or missing, we say the template version.
- Humor goes in the **copy**, never in the **logic**.

### 3. Kind truth (why the grandson exists in this story)
- Bad news is delivered **gently, specifically, and with a next step.** Never just "apple pie is down 40%", but *"Apple pie needs a little love: 40% fewer slices than last month. Maybe try it warm with the cream we have extra of?"*
- Never insult Grandma's food. Products are "stars", "solid" or "need a little love". Nothing "sucks".
- Every negative insight comes with **one** actionable suggestion, not five.

### 4. Interrupt wisely (rush-aware)
- Nonna knows how busy the bakery is. **During a rush, only `urgent` things are spoken** (out of stock on a top seller, delivery at the door). Everything else waits in the queue and is said when it's quiet.
- Never repeat the same alert more than once per hour unless it gets worse.
- Spoken messages are **max 2 short sentences** (~20 words). Details live on the dashboard.

| Severity | Example | Spoken during a rush? |
|---|---|---|
| `urgent` | "We're OUT of cups." | Yes, immediately |
| `nudge` | "Cream is low, should I order?" | No, queued until it's quiet |
| `info` | "Gerald's delivery was received." | No, queued, can be batched |

### 5. Nonna's allowance: small stuff on autopilot, big stuff asks, and she always tells you
- **Routine restocks are placed without asking.** Routine means: triggered by low stock or expiry, the usual quantity from the usual supplier, **≤ $25**, and within a **$100/week autopilot budget**. Nonna tells Grandma *afterwards*, with an easy undo: *"I ordered the usual flour from BulkMart, $15. Say 'cancel' if you don't want it."*
- **Anything unusual asks first**: over $25, over the weekly budget, a manual or odd request, a declined card. *"Should I order 4 litres of cream from Gerald for $28?"*
- **Three limits stack**, so there's no spending spree: per-order cap → weekly autopilot budget → each supplier card's own weekly limit (the hard ceiling).
- Every autopilot order is visible on the dashboard and **cancellable until it arrives** (refunded on the card).
- Everything else (tracking, consuming stock, logging waste from expiry, analytics) happens **silently and automatically**.
- No double orders, ever: one open reorder per ingredient.

### 6. Always a fallback; the demo never dies
| If this fails… | …we fall back to |
|---|---|
| Wake word / speech recognition | Big TAP & TALK and YES / NO buttons on the kiosk |
| Claude API (slow >1.5s, or down) | Regex intents for yes/no + template phrasing |
| Nicer TTS | Browser `speechSynthesis` |
| Messenger | Speaker + dashboard feed |
| Live sales | Simulator + `/demo` "fire a rush" button |

The app **must run with zero API keys**. Keys make it nicer, not functional.

### 7. Two audiences, two surfaces
| | Kiosk (`/kiosk`) | Dashboard (`/dashboard`) |
|---|---|---|
| Who | Grandma, mid-work, hands full of dough | The grandson, at a laptop |
| Input | Voice first, 3 giant buttons max | Normal UI |
| Info density | One thing at a time, huge type (≥32px), high contrast | Tables, charts, heatmaps |
| Tone | Nonna's persona | Plain and factual, with Nonna quotes as flavor |

### 8. Demo-able at every commit
- `main` always runs: `npm run db:reset && npm run simulate && npm run dev` gives a working demo.
- Anything time-based uses the **demo clock** (`@/lib/clock`), so we can show "tomorrow" and "Saturday's rush" in seconds.
- If it can't be shown in the 3-minute demo, it's a stretch goal.

---

## Voice & tone guide

Nonna is the warm, slightly dramatic Italian-grandmother voice of the shop. She loves the bakery. She teases, but never mean-spiritedly.

**Do**
- *"Mamma mia, the cream is getting low. 1.4 litres left. Should I order 4 litres from Gerald?"*
- *"Here lies Berry Batch #3. Gone too soon. Tomorrow, specifically. Use the berries in today's parfaits?"*
- *"The Fall Parfait is a star. 38 sold this week, up from 22. Make 12 tomorrow, not 8."*
- *"Get ready, Saturday rush in about 20 minutes. I'll keep quiet until it's over."*

**Don't**
- ❌ Invent numbers: *"About 50 or so sold"* (say the exact number we computed)
- ❌ Lecture: three-paragraph answers spoken aloud
- ❌ Insult: *"The apple pie is terrible."*
- ❌ Act like a corporate assistant: *"I have processed your request."*
- ❌ Use offensive accent caricature. Flavor comes from warmth and word choice ("mamma mia", "tesoro"), not mockery.

---

## Engineering rules (the boring ones that keep 4 people in sync)

1. **Shared types live only in `src/lib/types.ts`.** It's the contract. Additive changes: post in chat. Breaking changes: get a 👍 from affected lanes first.
2. **Stay in your lane's folders.** Use other lanes only through their exported public functions, API routes or bus events, never their internals. Need something from another lane? Ask, or stub it locally and leave a `TODO(laneN)`.
3. **Time = `now()` from `@/lib/clock`.** Never `new Date()` or `Date.now()` for business logic.
4. **Money = integer cents. Quantities = base units** (g / ml / pcs).
5. **Cross-lane side effects go through the event bus** (`@/lib/events`). Inventory doesn't call notify; it emits `stock.low` and notify listens.
6. **Server-only code** (`@/lib/db`, `inventory`, `sales`, `analytics`, `notify`, `voice/intents`) is never imported from `"use client"` files. Client code talks to `/api/*`.
7. **Unbuilt = `todo("laneN …")`.** Routes turn that into a 501 so the UI can show "coming soon" instead of crashing.
8. **No new dependency without a one-line note in chat.** No native modules (we picked `node:sqlite` for this reason).
9. **Small commits, merge to `main` often** (at least every 2 hours). Run `npm run typecheck && npm run lint` before pushing.
