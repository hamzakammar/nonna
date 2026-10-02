# Lane 1: The Pantry 🧺
**Inventory, expiry, reordering, mock Ramp.**

> Your mission: Grandma never runs out and never throws money in the bin without knowing. Every sale quietly eats stock through the recipes. When something gets low or goes bad, Nonna proposes a reorder, and a "yes" pays for it on the supplier's (mock) Ramp card.

**You own:** `src/lib/inventory/`, `src/lib/ramp-mock/`, `src/lib/db/schema.ts`, `src/lib/db/seed.ts`, `src/app/api/inventory/`, `src/app/api/reorders/`
**You provide:** `listInventory`, `consumeForSale`, `scanExpiry`, `proposeReorder`, `approveReorder`, `cancelReorder`, `receiveReorder`, `listReorders`, `payments.*`; events `stock.low`, `stock.expiring`, `stock.expired`, `reorder.*`
**You consume:** `sale.recorded` (Lane 3), `clock.changed` (clock)

You're the **critical path**: Lane 2's best demo moment ("Should I order cream?" → "Yes") needs your reorder flow. Ship P0 first, fast and boring.

---

## Start here (first 45 min)
1. `npm install && npm run db:reset && npm run dev`, then open the DB with any SQLite viewer and look at `ingredients`, `stock_lots` and `recipe_items`.
2. Write the row → type mappers (`rowToIngredient`, `rowToReorder`, …) in `src/lib/inventory/rows.ts`.
3. Implement `listInventory()`. `GET /api/inventory` stops returning 501, and Lane 4 can build the inventory table against real data. **Push this ASAP.**

## P0: must ship (the demo depends on it)
- [ ] **`listInventory()`**: totals per ingredient across lots, `level` (`out` = 0, `low` ≤ reorderPoint), `nextExpiry`, `expiringSoonQty` (≤24h on the demo clock), `openReorderId`.
  *Done when:* seeded DB shows cream as `ok` at 1700 ml and berries with `expiringSoonQty` > 0.
- [ ] **`consumeForSale(sale)`**: recipe × qty, subtract FIFO by `expires_at`, in one `tx()`. Emit `stock.low` **only when crossing** the reorder point. Clamp at 0 and `console.warn`.
  *Done when:* recording 7 Fall Parfaits (30 ml cream each) takes cream from 1700 → 1490 and fires exactly one `stock.low`.
- [ ] **`proposeReorder` / `approveReorder` / `cancelReorder` / `listReorders`**: idempotent (one open reorder per ingredient). `costCents = Math.round(qty × unitCostCents)`. Approve calls `payments.charge` on the supplier's card and stores `rampTransactionId`.
- [ ] **Mock Ramp `payments`**: `listCards`, `charge` (declines if `SUSPENDED` or this week's spend + amount > limit → `CardDeclinedError`), `listTransactions`, `setCardState`. Backed by the `ramp_cards` / `ramp_transactions` tables.
- [ ] **`registerInventoryListeners()`**: `sale.recorded` → consume, `stock.low` → `proposeReorder(id, "low_stock")`.

## P1: makes the demo great
- [ ] **`scanExpiry()`** on `clock.changed`: emit `stock.expiring` once per lot, expire lots into `waste_events` (cost = qty × unit cost), propose a reorder if stock is now low.
  *Demo moment:* press "+1 day" on `/demo` and the berries die: waste is logged and Nonna holds a little funeral.
- [ ] **Auto-receive deliveries**: on `clock.changed`, any `placed` reorder older than the supplier's `leadTimeHours` → `receiveReorder` → new lot with `expiresAt = now + shelfLifeDays`.
- [ ] **`order_now` support** (for voice "Nonna, order more flour"): `proposeReorder` + immediate `approveReorder`.

## P2: stretch
- [ ] Smarter reorder qty: use Lane 3's `prepForecast()` to order enough for the next N days instead of the fixed `reorderQty`.
- [ ] Prefer local suppliers when price is within 10% (needs a second supplier per ingredient in the seed).
- [ ] Card over limit → Nonna says "Gerald's card is maxed for the week, should I raise it?"

## Gotchas
- Floats: quantities are REAL in SQLite. Compare with a small epsilon, or round to 2 decimals before checks.
- Never use `Date.now()`. Use `now()` from `@/lib/clock`.
- `stock.low` must fire once per crossing, or Nonna will nag every sale (rule 4).

## Agent kickoff prompt (paste into your coding agent)
```
You are working on Lane 1 (The Pantry) of the Nonna.exe hackathon repo.
Before writing code, read: CLAUDE.md, docs/DESIGN_PHILOSOPHY.md, docs/ARCHITECTURE.md, docs/roles/lane-1-pantry.md, src/lib/types.ts.
Only edit files your lane owns (listed at the top of your role doc). Use other lanes only via their public functions, API routes or bus events.
Work through P0 in order. After each task: npm run typecheck && npm run lint, then show me a curl or script that proves the "Done when" criterion.
```
