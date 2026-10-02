# Lane 1: The Pantry 🧺
**Inventory, expiry, reordering, mock Ramp.**

> Your mission: Grandma never runs out and never throws money in the bin without knowing. Every sale quietly eats stock through the recipes. When something gets low or goes bad, Nonna proposes a reorder, and a "yes" pays for it on the supplier's (mock) Ramp card.

**You own:** `src/lib/inventory/`, `src/lib/ramp-mock/`, `src/lib/pricewatch/`, `src/app/api/pricewatch/`, `src/app/api/suppliers/`, `src/lib/db/schema.ts`, `src/lib/db/seed.ts`, `src/app/api/inventory/`, `src/app/api/reorders/`
**You provide:** `listInventory`, `consumeForSale`, `scanExpiry`, `proposeReorder`, `approveReorder`, `cancelReorder`, `receiveReorder`, `receiveDueDeliveries`, `orderNow`, `logWaste`, `listReorders`, `listWaste`, `tick`, `payments.*`; events `stock.low`, `stock.expiring`, `stock.expired`, `reorder.*`
**You consume:** `sale.recorded` (Lane 3), `clock.changed` (clock)

You're the **critical path**: Lane 2's best demo moment ("Should I order cream?" → "Yes") needs your reorder flow. Ship P0 first, fast and boring.

---

## Start here (first 45 min)
1. `npm install && npm run db:reset && npm run dev`, then open the DB with any SQLite viewer and look at `ingredients`, `stock_lots` and `recipe_items`.
2. Write the row → type mappers (`rowToIngredient`, `rowToReorder`, …) in `src/lib/inventory/rows.ts`.
3. Implement `listInventory()`. `GET /api/inventory` stops returning 501, and Lane 4 can build the inventory table against real data. **Push this ASAP.**

## P0: must ship (the demo depends on it)
- [x] **`listInventory()`**: totals per ingredient across lots, `level` (`out` = 0, `low` ≤ reorderPoint), `nextExpiry`, `expiringSoonQty` (≤24h on the demo clock), `openReorderId`.
  *Done when:* seeded DB shows cream as `ok` at 1700 ml and berries with `expiringSoonQty` > 0.
- [x] **`consumeForSale(sale)`**: recipe × qty, subtract FIFO by `expires_at`, in one `tx()`. Emit `stock.low` **only when crossing** the reorder point. Clamp at 0 and `console.warn`.
  *Done when:* recording 7 Fall Parfaits (30 ml cream each) takes cream from 1700 → 1490 and fires exactly one `stock.low`.
- [x] **`proposeReorder` / `approveReorder` / `cancelReorder` / `listReorders`**: idempotent (one open reorder per ingredient). `costCents = Math.round(qty × unitCostCents)`. Approve calls `payments.charge` on the supplier's card and stores `rampTransactionId`.
- [x] **Mock Ramp `payments`**: `listCards`, `charge` (declines if `SUSPENDED` or this week's spend + amount > limit → `CardDeclinedError`), `listTransactions`, `setCardState`. Backed by the `ramp_cards` / `ramp_transactions` tables.
- [x] **`registerInventoryListeners()`**: `sale.recorded` → consume, `stock.low` → `proposeReorder(id, "low_stock")`.

## P1: makes the demo great
- [x] **`scanExpiry()`** on `clock.changed`: emit `stock.expiring` once per lot, expire lots into `waste_events` (cost = qty × unit cost), propose a reorder if stock is now low.
  *Demo moment:* press "+1 day" on `/demo` and the berries die: waste is logged and Nonna holds a little funeral.
- [x] **Auto-receive deliveries**: on `clock.changed`, any `placed` reorder older than the supplier's `leadTimeHours` → `receiveReorder` → new lot with `expiresAt = now + shelfLifeDays`.
- [x] **`order_now` support** (for voice "Nonna, order more flour"): `proposeReorder` + immediate `approveReorder`.

## P2: stretch
- [x] Smarter reorder qty: usage-based (own forecast from sales history in `inventory/forecast.ts`, no dependency on Lane 3): enough for delivery time + 5 days, never more than will be used before it spoils. Plus **early reorders** (reason `forecast`) when stock will run out before a delivery could arrive.
- [x] Prefer local suppliers when price is within 10% (`supplier_offers` table, `inventory/sourcing.ts`). Plus the **trade war**: `setOfferPrice()` re-picks the supplier and reports the margin and weekly $ impact per product.
- [x] Card over limit → `card.declined` event with a suggested limit → `raiseCardLimit(cardId, newLimit, thenApproveReorderId)` (max 2× or +$100 in one go).

## Status (for other lanes)
P0 + P1 are done. Prove it with `npm run check:pantry` (runs against a throwaway DB).
- **Voice (Lane 2):** `VoiceAction` → `approve_reorder` = `approveReorder`, `cancel_reorder` = `cancelReorder`, `order_now` = `orderNow`, `mark_received` = `receiveReorder`, `log_waste` = `logWaste`. `approveReorder` throws `CardDeclinedError` (`reason: "suspended" | "over_limit"`) and leaves the reorder `proposed`.
- **Nonna's allowance** (`src/lib/inventory/autopilot.ts`): a routine reorder (low_stock/expired, normal qty + supplier, ≤ $25, within $100/week autopilot budget) is placed immediately. It emits `reorder.placed` with `autoApproved: true` and **no** `reorder.proposed`. Everything else emits `reorder.proposed`. `autopilotStatus()` and `GET /api/ramp` → `autopilot` show the budget. Env: `AUTOPILOT_MAX_ORDER_CENTS`, `AUTOPILOT_WEEKLY_BUDGET_CENTS`.
- **Sourcing:** each ingredient can have several `supplier_offers`. The pick (cheapest, or local if ≤10% pricier) is written to `ingredients.supplier_id/unit_cost_cents`, so margins stay correct without knowing about offers. Seed: milk → Maple Hill, apples/eggs → Rosa (local wins), butter → BulkMart, cream → Gerald. Reorders carry a `note` explaining supplier + qty.
- **Trade war:** `POST /api/suppliers/price {supplierId:"sup_gerald", ingredientId:"ing_cream", unitCostCents:0.95}` → Gerald +36%, we switch to Maple Hill (local), returns a `PriceChange` with per-product margins and `weeklyImpactCents`. Also emits `price.changed`.
- **Forecast:** with sales history, `listInventory()` adds `dailyUsage`, `daysOfCover`, `runsOutAt`. Reorders are sized to usage. `tick()` proposes `forecast` reorders (always asks, and won't re-ask for 24h after a "no").
- **Maxed card:** approving over a card's weekly limit emits `card.declined` with `suggestedLimitCents`. Grandma says yes → `raise_card_limit` voice action → `raiseCardLimit()` / `POST /api/ramp/limit`.
- With the seed, **cream ($28) asks** (Gerald raised prices; this is the demo's yes/no moment). Flour, sugar, milk, pumpkin and apples restock on autopilot.
- **`stock.low`** fires once per crossing of the reorder point, and again when stock hits 0. If both happen in one sale, it fires **once** with `totalQty: 0`. Treat `totalQty === 0` as "out", which means `urgent`.
- **Ledger (Lane 3):** waste is in `waste_events` (or `listWaste(sinceIso)`).
- **Shop Window (Lane 4):** `GET /api/ramp` returns cards with `weeklySpendCents` + the latest 20 transactions. `POST /api/reorders/:id/approve` returns **402** `{declined, cardId}` when the card declines. `GET /api/ramp` also returns `autopilot: {maxOrderCents, weeklyBudgetCents, spentCents, remainingCents}`. Show it as "Nonna's allowance: $24 of $100 used this week", and badge autopilot reorders on the reorders list.
- Seeded berries are "expiring soon" at start. `+1 day` on the demo clock expires them (≈$33 waste) and proposes a reorder.

## Price Watch (competitor prices), automatic
Nobody types competitor prices. Once a day on the demo clock (`src/lib/pricewatch/refresh.ts`, or `POST /api/pricewatch/refresh`):
1. **Discover** nearby bakeries (`PRICEWATCH_DISCOVERY`):
   - `mock` (default): `fixtures/places.json`, offline
   - `osm`: OpenStreetMap Overpass. **Free, no key, no card.** Live around Uptown Waterloo it finds 11 bakeries, 9 with websites.
   - `google`: Places Text Search. One call returns 20 places with website + reviews. A **hard monthly cap** (`GOOGLE_PLACES_MONTHLY_CAP`, default 900) keeps it inside Google's free quota; past the cap it refuses *before* calling. Google still requires a billing account on file.
2. **Read their own website**, cheapest first: Shopify `/products.json` → WooCommerce Store API → JSON-LD (Menu/Product) → "Item … $price" text → Claude (only with a key). Honest User-Agent, **robots.txt respected**, 10s timeout. *Live: 3 of 9 real sites read automatically (241 prices); Square Online / Squarespace / Toast aren't supported yet.*
3. **Record only changes** → `competitor.prices` → Nonna: "The Bakery dropped their parfait to $6.95". New bakeries → `competitor.discovered`.
4. **Reviews** (Google/mock): counts of "pricey" vs "good value" plus quoted prices, **computed live, never stored** (Google's caching rules).

Google Maps / Uber Eats pages are never scraped (against their terms, and Places has no menu prices anyway). Google names aren't stored either: we keep the place id (allowed) and take the name from their own website.
Demo lever: `POST /api/pricewatch/refresh {"mockVariant":"sale"}` makes The Bakery's mock site drop its parfait to $6.95. Mock sites are viewable at `/mock/the-bakery/menu`.

**Nonna's Petty Mode 😤** (stage joke, `src/lib/pricewatch/roast.ts`): `POST /api/pricewatch/roast {spice: 1|2|3}` → three absurd one-star "reviews" of the rival, built from real Price Watch numbers. `POST /api/pricewatch/roast/post` is the "Post to Google" button: it **never posts** and always returns **418** with Nonna's veto (*"Absolutely not. We beat them with better parfaits, not lies."*), which is the punchline. Mock competitors only (real ones → 403). No Google/Yelp integration exists, so keep it that way.

Fallbacks when automation can't read a site:
- **Mock feed**: The Bakery's menu (the rival named in the brief), seeded with one example of each verdict
- **Menu photo**: `POST /api/pricewatch/photo` (multipart `photo`, optional `competitorName`). Claude reads items and prices and maps them to our product ids (strict schema). Returns **503** without Anthropic credentials. *Not yet tested against the live API.*
- **Voice/manual**: `POST /api/pricewatch/prices {competitorName, items:[{itemName, priceCents}]}`. Names are matched to our products with a deterministic matcher.

`priceAdvice()` compares each product with the cheapest competitor, using our ingredient cost at today's supplier prices and a **60% margin floor** (`PRICEWATCH_MIN_MARGIN`): `undercut` (25¢ under them, if it stays above the floor) · `cant_undercut` · `raise` (we're ≥50¢ cheaper) · `hold`. `setPrice()` / `POST /api/pricewatch/apply` refuses prices below the floor. A trade-war cost hike raises the floor automatically. New prices emit `competitor.prices` with only the actionable advice.

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
