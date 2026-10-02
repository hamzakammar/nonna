# Lane 2: The Voice 🗣️
**Wake word, speech-to-text, intents, Nonna's persona, text-to-speech, notifications (speaker + Messenger).**

> Your mission: Grandma never touches the system. She hears Nonna in the bakery, answers out loud, and things happen. You are the product's personality and the demo's showstopper.

**You own:** `src/lib/voice/`, `src/lib/notify/`, `src/app/api/voice/`, `src/app/api/notifications/`
**You provide:** `useNonnaEars()` and `speak()` (client hooks the kiosk uses), `notify()`, `subscribe()`, `acknowledge()`, `handleUtterance()`, the SSE stream
**You consume:** every event in `EventMap`; Lane 1 functions (`listInventory`, `approveReorder`, …); Lane 3 functions (`rushStatus`, `productPerformance`, `gentleTruths`)

---

## Start here (first 45 min)
1. Read `docs/DESIGN_PHILOSOPHY.md` § Voice & tone **twice**. You are the guardian of rules 1, 2, 4 and 6.
2. Get the round trip working with **no AI at all**: implement `notify()` (persist + in-memory subscriber list) and `subscribe()`, then add a temporary `POST /api/notifications/test` that fires a fake low-stock notification. Open `/api/notifications/stream` in the browser and watch it arrive.
3. Implement `useNonnaEars` with Web Speech API in Chrome. Log transcripts to the console. Say "Nonna, how's the cream?"

## P0: must ship
- [ ] **Notification pipeline**: `notify()` persists to `notifications`, fills `spoken` via `persona.template()`, and pushes to SSE subscribers. Default channels: speaker + dashboard.
- [ ] **Event → notification mapping** in `registerNotifyListeners()`:
  - `reorder.proposed` → `nudge` with `awaitingAnswer: { question: "Should I order 4 litres of cream from Gerald's Dairy for $28?", onYes: approve_reorder, onNo: snooze }`
  - `reorder.placed` with `reorder.autoApproved === true` (Nonna's allowance, routine restock ≤ $25) → `info`, announced **after the fact** with an undo: `awaitingAnswer: { question: "I ordered the usual flour from BulkMart, $15. Want to keep it?", onYes: none, onNo: cancel_reorder }`. Also accept "cancel" without the wake word for a minute or so.
  - `card.declined` (over_limit) → `nudge`: *"Gerald's card is maxed for the week, $560 of $600. Raise it to $650 and order?"* `onYes: { type: "raise_card_limit", cardId, newLimitCents: suggestedLimitCents, thenApproveReorderId: reorder.id }`. For `suspended`, just explain it. Don't offer a raise.
  - `price.changed` → `nudge` (P1): lead with `weeklyImpactCents`, then the switch: *"Gerald raised cream 36%. That's $9 more a week on parfaits. Maple Hill is local and cheaper now, so I'll buy from them."* If `after.supplierId === before.supplierId`, there's no switch to announce.
  - `competitor.discovered` → `info` (dashboard only): "Spotted a new bakery nearby: Crumb & Co."
  - Refresh results carry a live **review signal** (`reviews.saysPricey` / `saysGoodValue`). Nonna can say "3 of 5 recent reviews call The Bakery pricey". Don't persist review text.
  - `competitor.prices` → `nudge`, spoken only when it's quiet: say each advice's `reason` in Nonna's voice. For `undercut`/`raise`: `awaitingAnswer: { question: "Drop the Fall Parfait to $7.00?", onYes: { type: "set_price", productId, priceCents: suggestedPriceCents } }` → `setPrice()` from `@/lib/pricewatch`. Voice entry: "Nonna, The Bakery's parfait is $7.25" → `recordPrices(…, "voice")`.
  - Reorder `note` explains the supplier and qty in plain words. Use it when Grandma asks "why so much?" or "why them?".
  - `stock.expiring` → `nudge` · `stock.expired` → `info` (include waste $) · `reorder.placed` (Grandma-approved) / `received` → `info`
  - Out of stock (level `out`) on any ingredient → `urgent`
- [ ] **Ears** (`useNonnaEars`): continuous recognition, wake word "Nonna" (also match "nona", "nana", "nonnah"; STT is sloppy), auto-restart on `end`, no wake word needed while `expectingAnswer`. **Pause while speaking** so she doesn't hear herself.
- [ ] **`handleUtterance` fast path**: a pending question plus `quickYesNo()` executes `onYes`/`onNo` via Lane 1 and replies with a template. **Works with zero API keys.**
- [ ] **Mouth** (`speak`): browser speechSynthesis. Pick the best available English voice.

## P1: makes the demo great
- [ ] **Claude intents** (`NONNA_FAST_MODEL`, tool use) for open questions. Tools: `get_inventory`, `get_sales_summary`, `get_rush_status`, `get_gentle_truths`, `approve_reorder`, `cancel_reorder`, `order_now`, `mark_received`, `log_waste`, `snooze`. Tool results come from Lane 1/3 functions. 1.5s timeout → *"Sorry tesoro, say that again?"*
  *Done when:* "Nonna, what's selling best this week?" answers with Lane 3's real numbers.
- [ ] **`stylize()`** with Claude using `NONNA_SYSTEM_PROMPT`. Write a check that every number in `text` still appears in the styled output, and use the template if one doesn't.
- [ ] **Rush-aware queue** (differentiator!): listen to `rush.changed`. While `busy`/`rush`, only `urgent` is spoken; the rest queues. When it gets quiet: *"Okay, it's calm now. Two things while you were busy…"*
- [ ] **Facebook Messenger** (`channels/messenger.ts`) for `urgent` items + the end-of-day summary. Setup: Facebook Page → Meta app (dev mode) → Messenger product → page access token. Grandma's account messages the Page once (that opens the 24h window). Put the token and PSID in `.env.local`. **Do the setup early.** Meta's dashboard is slow, and it's the most likely thing to block you.

## P2: stretch
- [ ] Nicer TTS voice behind `speak()` (keep the browser fallback).
- [ ] End-of-day spoken summary at closing (on `insight.ready`): sales, best seller, one Gentle Truth, waste $.
- [ ] Voice-recorded sales: "Nonna, we sold 3 croissants" → `recordSale` with `source: "voice"`.
- [ ] Snooze: "remind me in 10 minutes".

## Gotchas
- Web Speech API is **Chrome only** and needs a mic permission + HTTPS or localhost. Demo on Chrome.
- Browsers block audio until a user gesture: the kiosk needs a one-time "Start Nonna" tap (agree on this with Lane 4).
- Never let the LLM produce numbers. If you're unsure, see Rule 2.

## Agent kickoff prompt
```
You are working on Lane 2 (The Voice) of the Nonna.exe hackathon repo.
Before writing code, read: CLAUDE.md, docs/DESIGN_PHILOSOPHY.md (especially "Voice & tone"), docs/ARCHITECTURE.md, docs/roles/lane-2-voice.md, src/lib/types.ts.
Only edit files your lane owns. Use Lane 1/3 only via their exported functions; if they still throw "Not implemented", stub the call locally behind a TODO and continue.
The app must work with zero API keys: the template + regex fallbacks come first, Claude second.
Work through P0 in order; after each task run npm run typecheck && npm run lint and tell me how to verify it in the browser.
```
