# Nonna.exe: Project Charter

> **Status: DRAFT. Agree on this before we start building.**
> Everyone reads it, comments or edits, then signs the table at the bottom. Open questions are in § 10. Settle those first.

---

## 1. The problem

From the organisers' brief (*Grandma's Wishlist*, Operations + Bookkeeping):

- **Inventory ledger:** orders, arrivals, payments, stock and spoilage dates are *"recorded by hand or kept in Grandma's head."*
- **Purchasing & suppliers:** she orders from the same suppliers every morning, from memory.
- **Sales & payment records:** a standalone Verifone, a handwritten ledger, and chaos at tax time.
- Plus the problem nobody wrote down: **nobody wants to tell Grandma her apple pie isn't selling.**

Grandma doesn't need more software. She needs a helper who **remembers everything, speaks up at the right moment, and does the boring part when she says "yes".**

## 2. The vision

**Nonna.exe** is a voice-first back office that lives in the bakery. It watches sales, quietly tracks what every sale uses up, notices when something is running low or going bad, and *asks Grandma out loud* whether to reorder. She answers "yes" without putting down the rolling pin.

> *"Mamma mia, cream is low. 1.4 litres left. Should I order 4 litres from Gerald for $28?"*
> *"Yes."*
> *"Done, tesoro. It arrives tomorrow morning."*

Funny on the surface, and useful underneath.

## 3. Goals (what "done" means)

| # | Goal | Measured by |
|---|---|---|
| G1 | **Sales automatically deplete inventory** through recipes | A sale on the till changes stock within 1s, with correct ingredient math |
| G2 | **Low stock and expiry trigger a reorder proposal**, never a duplicate | Live: 7 parfaits → one cream reorder proposed |
| G3 | **Grandma interacts by voice only** (button fallback) | Full reorder approved by voice in the demo, no keyboard |
| G4 | **Nonna notifies Grandma** in the bakery (speaker) and remotely (Messenger, P1) | The spoken prompt arrives within 2s of the trigger |
| G5 | **Sales performance without the awkward talk** | Gentle Truth for Apple Pie with real numbers and one suggestion |
| G6 | **Busyness tracking + analytics** beyond plain sales totals | Heatmap, live rush status, prep forecast on the dashboard |
| G7 | **Runs with zero API keys** | Fresh clone → demo works offline (template voice) |

## 4. Non-goals (we will NOT build these)

- Real Verifone / POS integration (standalone terminal, so we use a mock till + simulator)
- Real Ramp API or real money movement (**mock Ramp only**: one card per supplier with limits)
- User accounts, auth, multi-shop, cloud deploy
- Full accounting / tax filing (the waste $ and spend data are a teaser at most)
- Customer-facing features (menu, allergens, loyalty). Those are other wishlist items.
- Native mobile apps

## 5. Scope

| Area | P0, must ship | P1, makes the demo great | P2, stretch |
|---|---|---|---|
| Inventory (Lane 1) | Recipe-based depletion, FIFO lots, low-stock detection, propose/approve/cancel reorders, mock Ramp payments | Expiry scan + waste log, auto-receive deliveries, "order now" | Forecast-driven quantities, local-supplier preference, card-limit handling |
| Voice (Lane 2) | Notification pipeline + SSE, wake word STT, yes/no fast path, browser TTS | Claude intents + persona, **rush-aware queue**, Messenger | Nicer TTS, end-of-day spoken summary, voice-logged sales |
| Analytics (Lane 3) | Record sales, simulator, product performance, busyness heatmap, rush status | **Gentle Truth**, prep forecast, waste $, end-of-day insights | **Camera people counter**, weather-aware forecast, lost-sales estimate |
| UI & demo (Lane 4) | Kiosk, dashboard (inventory/reorders/feed), mock till, demo clock | Analytics panels, story buttons, Ramp panel, rehearsed demo | Nonna mood, waste graveyard, mobile view, deck |

**Scope rule:** nobody starts P1 until their P0 is merged and works end-to-end with the others. Nobody starts P2 until the demo has been rehearsed once.

## 6. What makes us different

Every team in this track will build "inventory + low-stock alert". Here's what sets us apart:

1. **Zero-UI for the owner.** Grandma never opens an app. Voice in, voice out. **Nonna's allowance:** routine restocks under $25 happen on autopilot (announced, one word to undo), and anything bigger or unusual gets a spoken yes/no.
2. **Rush-aware interruptions.** Nonna knows how busy the shop is and **holds non-urgent news until the rush is over**. No other inventory app is polite.
3. **Busyness tracking.** A live rush meter and a weekly heatmap from sales cadence, optionally fused with an **on-device camera people counter** (no images stored).
4. **The Gentle Truth.** Product performance delivered kindly with one concrete fix. It solves the human problem, not just the data problem.
5. **Bake-tomorrow forecast + waste in dollars.** Moves from "tracking" to "deciding": *make 14, not 20*, and *you threw away $18 of berries this week*.
6. **Honest AI.** The LLM never invents a number. Code computes, Nonna talks. Good to say out loud to technical judges.
7. **Trade-war proof, local first.** When a supplier hikes prices, Nonna shows the dollars-per-week hit, switches to the best offer, and prefers local growers when they're within 10%. That covers two more wishlist items ("Trade war", "Local legend").
8. **Price Watch.** Nonna knows The Bakery's prices (mock feed, or a photo of their menu read by Claude) and says exactly how far we can undercut without dropping below a 60% margin, or when to raise because we're leaving money on the table. Covers the brief's "Flavor of the month: beat The Bakery".
9. **Spend controls built in.** Every supplier is paid from its own (mock) Ramp-style card with a weekly limit, so expenses are tracked automatically. Keep it to one sentence in the pitch, but it's there.

## 7. Team & roles

Four lanes, one owner each. Each person may drive their lane with a coding agent. The agent follows the same docs (see `CLAUDE.md`).

| Lane | Name | Owner | Role doc |
|---|---|---|---|
| 1 | 🧺 The Pantry: inventory, expiry, reorders, mock Ramp | @hamzakammar | [`roles/lane-1-pantry.md`](roles/lane-1-pantry.md) |
| 2 | 🗣️ The Voice: wake word, STT/TTS, intents, persona, notifications | _TBD_ | [`roles/lane-2-voice.md`](roles/lane-2-voice.md) |
| 3 | 📈 The Ledger: sales, simulator, analytics, busyness, forecast | _TBD_ | [`roles/lane-3-ledger.md`](roles/lane-3-ledger.md) |
| 4 | 🪟 The Shop Window: kiosk, dashboard, till, demo, pitch | _TBD_ | [`roles/lane-4-shop-window.md`](roles/lane-4-shop-window.md) |

Team: @hamzakammar, @markrozin, @natelamarche, @Mo-Naq1. **Assign lanes in § 10.**

Suggested fit: Lane 1 = strongest backend/data person (critical path). Lane 2 = whoever is most excited about voice/AI. Lane 3 = likes data and SQL. Lane 4 = frontend + the person who'll present.

## 8. Timeline & checkpoints

Times are relative to kickoff (**T+0**) and assume a ~24h hackathon. Scale them if ours is different (§ 10).

| When | Checkpoint | Everyone verifies |
|---|---|---|
| T+0:30 | **Charter signed**, lanes assigned, everyone has run `npm run dev` | — |
| T+2 | **Foundations**: `recordSale`, `listInventory`, `/pos`, notify → SSE | Tap a sale on `/pos` → stock changes on the dashboard |
| T+6 | **🎯 Vertical slice (the key milestone)** | Sell 7 parfaits → Nonna *says* "should I order cream?" → say "yes" → reorder placed on the mock Ramp card |
| T+10 | **Simulator + analytics** | Dashboard shows a heatmap, rankings and a rush status |
| T+14 | **P1 features**: Gentle Truth, rush-aware queue, expiry/waste, Claude persona | Full demo script runs, rough |
| T+18 | **Feature freeze** 🧊 | Only bug fixes, copy and polish after this |
| T+20 | **Rehearsal ×2** on the demo laptop + backup video recorded | — |
| T+22 | Buffer / pitch polish | — |

**Sync:** 5-minute stand-up at each checkpoint: done, next, blocked.

## 9. Working agreements

- **Read `docs/DESIGN_PHILOSOPHY.md` first.** It's the tie-breaker for every disagreement.
- **Contract first:** `src/lib/types.ts` is shared. Additive change → post in chat. Breaking change → 👍 from affected lanes.
- **Stay in your lane's folders.** Cross-lane: exported functions, `/api/*` and bus events only.
- **Blocked by another lane? Don't wait.** Stub it locally with a `TODO(laneN)` and keep going.
- **Git:** short-lived branches `laneN/<thing>`, merge to `main` at least every 2h, `npm run typecheck && npm run lint` before pushing. `main` must always run.
- **Agents:** each agent gets the kickoff prompt from its role doc. Humans review agent diffs before merging, especially anything touching `types.ts` or `schema.ts`.
- **Secrets** go in `.env.local` only, never committed.
- **Disagreement** → philosophy doc → lane owner decides within their lane → whole team only if it crosses lanes. Max 5 minutes, then pick and move.

## 10. Open decisions (settle these at kickoff)

| # | Question | Proposed default |
|---|---|---|
| D1 | Who owns which lane? | See suggestions in § 7 |
| D2 | How long is the hackathon / when is judging? | Assume 24h, scale § 8 |
| D3 | Who presents? | Lane 4 owner + whoever owns the voice for a live back-and-forth |
| D4 | Messenger: whose Facebook account plays "Grandma"? | Lane 2 owner sets up the Page + test account in the first 2h |
| D5 | Camera people counter: are we doing it? | Yes as P2, only after the rehearsal |
| D6 | Demo hardware: which laptop, external speaker/mic? | One laptop running everything, Chrome, a USB speakerphone if anyone has one |
| D7 | Does anything need to change in this charter? | — |

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Speech recognition fails in a noisy venue | **High** | Giant YES/NO buttons, push-to-talk, USB mic, rehearse in the venue |
| Lane 1 slips and blocks the vertical slice | Medium | Lane 1 ships P0 before anything else. Others stub around it |
| Claude latency makes voice feel slow | Medium | Regex fast path for yes/no, Haiku for intents, 1.5s timeout → template |
| Meta/Messenger setup eats hours | Medium | Start early, cap at 1h, speaker-only is fine |
| Integration chaos at the end | Medium | Shared types from minute 0, T+6 vertical slice, feature freeze at T+18 |
| Scope creep | **High** | P0/P1/P2 rule in § 5 |

## 12. Sign-off

By signing, you agree on the goals, non-goals, your lane, and the working agreements.

| Name | Lane | Agree? | Comments |
|---|---|---|---|
| @hamzakammar | 1 | ☐ | |
| @markrozin | | ☐ | |
| @natelamarche | | ☐ | |
| @Mo-Naq1 | | ☐ | |
