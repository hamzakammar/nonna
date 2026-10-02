# Architecture

One Next.js app, one SQLite file, one in-process event bus. Simple enough to run on a laptop at the bakery counter.

```
                       ┌───────────────────────────── Next.js server ─────────────────────────────┐
                       │                                                                           │
  /pos (till) ──POST /api/sales──▶ LANE 3 sales.recordSale ──emit sale.recorded──┐                 │
  simulator ───────────────────▶        │                                         ▼                 │
                       │                │                         LANE 1 inventory.consumeForSale   │
                       │                │                           (recipes → FIFO stock lots)     │
                       │                ▼                                         │                 │
                       │   LANE 3 analytics ◀──── reads sales, waste ────         │ emit stock.low  │
                       │   (performance, busyness, rush,                          ▼                 │
                       │    prep forecast, gentle truths)          LANE 1 proposeReorder            │
                       │          │ emit rush.changed                  │ emit reorder.proposed      │
                       │          │ emit insight.ready                 ▼                            │
                       │          └──────────────────────▶  LANE 2 notify  (rush-aware queue)      │
                       │                                         │ persona phrasing (Claude/template)│
                       │                                         ├──▶ SSE /api/notifications/stream │
                       │                                         └──▶ Messenger (P1)                │
                       │                                                                           │
  /kiosk ◀── SSE ──────┤   speaks it (TTS) ── Grandma: "yes" ── STT ──POST /api/voice──▶            │
                       │                       LANE 2 intents.handleUtterance                      │
                       │                         └─▶ LANE 1 approveReorder ──▶ ramp-mock.charge    │
                       │                                    emit reorder.placed                    │
  /dashboard ◀── GET /api/inventory, /api/reorders, /api/analytics/*, SSE                          │
  /demo ─────── POST /api/sim (moves the demo clock → emit clock.changed → expiry scan, deliveries)│
                       └───────────────────────────────────────────────────────────────────────────┘
```

## Folders and who owns them

| Path | Owner | What |
|---|---|---|
| `src/lib/types.ts` | **Everyone** (contract) | Shared domain types + `EventMap` |
| `src/lib/clock.ts`, `events.ts`, `db/index.ts`, `api.ts`, `boot.ts` | Everyone (foundation, rarely changes) | Demo clock, event bus, DB handle, route helper, listener wiring |
| `src/lib/db/schema.ts`, `db/seed.ts` | Lane 1 | Tables + baseline data |
| `src/lib/inventory/`, `src/lib/ramp-mock/` | Lane 1, Pantry | Stock, FIFO, expiry, reorders, mock payments |
| `src/lib/voice/`, `src/lib/notify/` | Lane 2, Voice | Wake word, STT, intents, persona, TTS, notification queue, Messenger |
| `src/lib/sales/`, `src/lib/analytics/`, `scripts/simulate.ts` | Lane 3, Ledger | Sales intake, simulator, performance, busyness, forecast, Gentle Truth |
| `src/app/**/page.tsx`, `src/components/` | Lane 4, Shop Window | Kiosk, dashboard, till, demo control, all visuals |
| `src/app/api/<area>/` | Same lane as the lib it wraps | Thin wrappers. Logic lives in `src/lib` |

## API surface

| Method & path | Lane | Returns |
|---|---|---|
| `POST /api/sales` `{items:[{productId,qty}], paymentMethod}` | 3 | `Sale` |
| `GET /api/sales` | 3 | `Sale[]` (last 24h) |
| `GET /api/inventory` | 1 | `IngredientStatus[]` |
| `GET /api/reorders` · `POST /api/reorders` `{ingredientId, qty?}` | 1 | `Reorder[]` / `Reorder` |
| `POST /api/reorders/:id/approve\|cancel\|receive` | 1 | `Reorder` / `StockLot` (approve → **402** `{declined, cardId}` if the card declines) |
| `GET /api/ramp` | 1 | `{cards: (RampCard & {weeklySpendCents})[], transactions: RampTransaction[], autopilot: AutopilotStatus}` |
| `GET /api/analytics/products\|busyness\|rush\|prep\|truths\|waste?days=N` | 3 | see `src/lib/analytics` |
| `POST /api/voice` `{transcript, pendingNotificationId?}` | 2 | `VoiceResponse` |
| `GET /api/notifications/stream` | 2 | SSE: `{type:"notification", notification}` |
| `GET/POST /api/sim` `{advanceHours}` \| `{reset:true}` | 4 | `{now}` |

Unbuilt functions return **501** `{error:"Not implemented yet: laneN …"}`. The UI should show a friendly placeholder for these, not crash.

## Events (`src/lib/events.ts`, payloads in `EventMap`)

| Event | Emitted by | Listened to by |
|---|---|---|
| `sale.recorded` | Lane 3 | Lane 1 (consume stock), Lane 3 (rush) |
| `stock.low` | Lane 1 | Lane 1 (propose reorder), Lane 2 |
| `stock.expiring` / `stock.expired` | Lane 1 | Lane 2 |
| `reorder.proposed` / `placed` / `received` | Lane 1 | Lane 2 (`placed` with `autoApproved` = announce + offer undo) |
| `rush.changed` | Lane 3 | Lane 2 (hold or flush the queue), Lane 4 via SSE |
| `insight.ready` | Lane 3 | Lane 2 |
| `notify` | Lane 2 | (internal) |
| `clock.changed` | clock | Lane 1 (expiry, deliveries), Lane 3 (end-of-day) |

## Key decisions (and why)

| Decision | Why |
|---|---|
| Single Next.js app, not microservices | Four people, one weekend. One `npm run dev`. |
| `node:sqlite` (built into Node ≥22.13) | No native compile step, so nobody burns an hour on build errors. |
| In-process event bus | Lanes stay decoupled with no infrastructure. Fine for one shop and one server. |
| Demo clock | Expiry, deliveries and weekly trends must be demoable in 3 minutes. |
| Web Speech API for STT/wake word | Free, zero setup, works in Chrome. A big button covers the rest. |
| Claude for intents + phrasing only | Natural language in and warm language out, with numbers kept deterministic. |
| Mock Ramp, not real | No account or KYC needed. Shapes mirror their API, so swapping it is plausible. |
| Sales from mock till + simulator | Grandma's Verifone is standalone, and we can't integrate it this weekend. |
