# Lane 3: The Ledger 📈
**Sales intake, simulator, product performance, busyness, rush detection, prep forecast, the Gentle Truth.**

> Your mission: know the shop better than Grandma's memory does. What sells, what doesn't, when it gets busy, and how much to bake tomorrow, so the grandson never has to tell Grandma her apple pie isn't selling. Nonna does it, kindly, with numbers.

**You own:** `src/lib/sales/`, `src/lib/analytics/`, `scripts/simulate.ts`, `src/app/api/sales/`, `src/app/api/analytics/`
**You provide:** `recordSale`, `listSales`, `productPerformance`, `busynessHeatmap`, `rushStatus`, `prepForecast`, `gentleTruths`, `wasteSummary`; events `sale.recorded`, `rush.changed`, `insight.ready`
**You consume:** `products`, `recipe_items`, `ingredients`, `waste_events` tables (read-only); `clock.changed`

Most of the **differentiators** live in your lane. See the charter § "What makes us different".

---

## Start here (first 45 min)
1. Implement `recordSale()` (price from `products`, insert sale + items in one `tx()`, emit `sale.recorded`). Now `/pos` and Lane 1 can work end to end. **Push this ASAP.**
2. Start the simulator (`scripts/simulate.ts`). Everyone's charts are empty until it exists.

## P0: must ship
- [x] **`recordSale` / `listSales`**: reject unknown or inactive products and qty ≤ 0 with a clear error.
- [x] **Simulator** `npm run simulate -- --days 21 --seed 42`:
  - Opening hours 7:00–18:00. Shape: coffee peak 7:30–9:30, lunch peak 11:30–13:30, dead around 15:00. **Saturday is the busiest day, Monday the quietest.**
  - Built-in story: **Fall Parfait trending up** (~+60% over 3 weeks), **Apple Pie trending down** (~−40%), Croissant steady and top seller, espresso/latte follow the coffee peak.
  - Deterministic (seeded PRNG), writes directly to the DB with `source: "simulator"`, **does not consume inventory**, history ends at "now".
  - *Done when:* `productPerformance(7)` ranks Croissant #1, flags Fall Parfait `rising` and Apple Pie `falling`/`struggling`.
- [x] **`productPerformance(days)`**: units, revenue, margin (revenue − Σ recipe qty × unit cost), trend vs the previous window (±15% threshold), rank, verdict (top 25% `star`, bottom 25% with a falling trend → `struggling`).
- [x] **`busynessHeatmap(days)`**: day-of-week × hour, average sales per hour, bucketed into levels 0–4 by quantiles. Also returns `marginPerHourCents` (profit per hour).
- [x] **`rushStatus()`**: sales in the last 30 min (demo clock) vs the heatmap's usual for this slot → `quiet | steady | busy | rush`, plus `nextRushAt` from the heatmap. Emit `rush.changed` when the label changes.

## P1: makes the demo great
- [x] **`gentleTruths(days)`**: for each `struggling` product, a `facts` string with exact numbers (*"Apple Pie: 31 slices in the last 14 days, down 42% from 53. Margin $3.10/slice."*) and one `suggestion` (time-of-day it still sells, pairing with an overstocked ingredient, smaller batch, price test). Also one compliment for the top `star`. Lane 2 makes it sound like Nonna.
- [x] **`prepForecast(date)`**: per product, average of the same weekday over the last 3 weeks, adjusted by trend, minus yesterday's leftovers if known → *"Make 14 Fall Parfaits tomorrow (avg of the last 3 Saturdays: 12, 13, 16)"*. Leftovers come from the make-list (morning batch − units sold off the shelf), are subtracted once the day before has closed, and stay on the shelf for one more day (`shelfLeft` / `carriedInto` in analytics).
- [x] **`wasteSummary(days)`**: $ lost per ingredient from `waste_events`.
- [x] **End of day**: on `clock.changed` crossing 18:00, emit `insight.ready` with the truths.

## P2: stretch (pick one, they're all good pitch material)
- [ ] **Camera people counter** 📷: a client-side TensorFlow.js `coco-ssd` on the kiosk webcam counts people in frame every 10s and POSTs counts to a `people_counts` endpoint. **No images are stored or sent.** Blend into the heatmap as `peopleAvg`. This is "busyness" that isn't just sales, which makes it a strong pitch point.
- [ ] **Weather-aware forecast**: Open-Meteo (free, no key). Rainy day → more lattes, fewer parfaits.
- [ ] **"Lost sales"** estimate: minutes a top product was out of stock × its usual sales rate.
- [x] **Make-list** (our P2 pick, instead of a heatmap screen): `src/lib/sales/prep.ts`, `/api/sales/todo`. A morning shelf batch per product from `prepForecast`, then every sale the shelf can't cover adds "make N for this customer" by itself. Phone or university orders can be added by hand. Drinks never go on it. `?next=1` gives the kiosk its one next task. New table `prep_tasks` (additive).
- [ ] **Staffing hint**: "Saturday 11–1 needs two people behind the counter."

## Gotchas
- All time maths uses the demo clock, and bucket by **local** hour (`getHours()`), not UTC.
- Keep functions pure-ish and fast (<50 ms). The dashboard polls them.
- You produce facts. You don't decide tone. Lane 2 adds the voice, you guarantee the numbers.

## Agent kickoff prompt
```
You are working on Lane 3 (The Ledger) of the Nonna.exe hackathon repo.
Before writing code, read: CLAUDE.md, docs/DESIGN_PHILOSOPHY.md, docs/ARCHITECTURE.md, docs/roles/lane-3-ledger.md, src/lib/types.ts, src/lib/db/schema.ts, src/lib/db/seed.ts.
Only edit files your lane owns. All numbers must be deterministic and computed in code; use now() from @/lib/clock, never Date.now().
Order: recordSale → simulator → productPerformance → busynessHeatmap → rushStatus → gentleTruths → prepForecast.
After each step run npm run typecheck && npm run lint and show output proving the "Done when" criterion.
```
