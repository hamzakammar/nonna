# Lane 4: The Shop Window 🪟
**Kiosk visuals, grandson's dashboard, mock till, demo control panel, pitch & demo run.**

> Your mission: make what the other three lanes build *visible* and *demoable*. You own what the judges see and the 3 minutes in which they see it. You're also the integrator: you're first to notice when lanes don't fit together.

**You own:** `src/app/**/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/`, `src/app/api/sim/`, `docs/DEMO.md`, the pitch slides
**You consume:** every `GET /api/*`, the SSE stream, Lane 2's `useNonnaEars()` + `speak()` hooks

---

## Start here (first 45 min)
1. Build a tiny `useApi(path)` hook that renders a friendly "🍳 still cooking" card for 501 responses. Every panel uses it, so the UI never crashes while lanes are unfinished.
2. **Mock till** (`/pos`): product tiles (emoji + name + price) → cart → **Card** / **Cash** → `POST /api/sales`. Lanes 1 and 3 need this to test, so ship it first. Products can be hard-coded from `seed.ts` until there's a `GET /api/products` (fine to add it yourself: read-only).
3. **Demo control** (`/demo`): show the demo clock, buttons for **+1 hour**, **+1 day**, **Reset clock**.

## P0: must ship
- [ ] **Kiosk** (`/kiosk`): the screen Grandma *might* glance at.
  - One-time **"Start Nonna 👵"** tap (unlocks mic + audio), then hands-free.
  - Giant status: 👂 listening / 🗣️ speaking / 💤 quiet. Big Nonna avatar that animates while speaking.
  - Current notification in ≥40px type. If it's a question: **giant YES / NO buttons** (fallback for a noisy bakery).
  - A small rush meter (quiet → rush). That's it. **Max 3 tappable things on screen.** (Philosophy rule 7.)
- [ ] **Dashboard** (`/dashboard`) for the grandson:
  - Inventory table: level pills (ok / low / out), next expiry, open reorder, "Order" button.
  - Reorders list with approve / cancel / receive.
  - Live notification feed (SSE) + Nonna voice transcript.
- [ ] **Mock till** (above) + a **"Fire a rush"** button on `/demo` (20 random weighted sales over a few seconds).

## P1: makes the demo great
- [ ] Dashboard analytics: product performance table with trend arrows + verdict badges, **busyness heatmap** (7×11 grid, warm colors), "Bake tomorrow" prep list, waste $ card, **Gentle Truth cards** with Nonna's quote.
- [ ] `/demo` story buttons: **"Jump to Saturday 11:00"**, **"+1 day (watch the berries die)"**, **"Reset world"** (needs a reset endpoint: coordinate with Lane 1 to re-seed).
- [ ] Mock Ramp panel: supplier cards with limit bars + the latest transactions. It's subtle, one panel.
- [ ] Inventory table: **days of cover** column (`daysOfCover`, `runsOutAt`) once the simulator has run. Reorder rows show `note` and an "autopilot" badge.
- [ ] Price Watch competitor list: how each was found (OSM / Google / mock), last check, status badge (ok / unchanged / robots_blocked / no_menu_found / no_website). A "Check now" button → `POST /api/pricewatch/refresh`. A `/demo` button **"The Bakery runs a sale 🏷️"** → `POST /api/pricewatch/refresh {"mockVariant":"sale"}`.
- [ ] **Price Watch panel**: `GET /api/pricewatch` → per product: ours vs theirs, margin, verdict badge (undercut / raise / hold / can't undercut), and an "Apply $7.00" button → `POST /api/pricewatch/apply`. Add a "📷 Snap their menu" upload → `POST /api/pricewatch/photo` (show the 503 message nicely if there's no API key).
- [ ] `/demo` **"Trade war 💥"** button: `POST /api/suppliers/price {supplierId:"sup_gerald", ingredientId:"ing_cream", unitCostCents:0.95}`. Show the returned `PriceChange` (margin before → after, $/week) as a big card on the dashboard. `GET /api/suppliers` for a supplier comparison table (local badge, current pick highlighted).
- [ ] **Own `docs/DEMO.md`**: rehearse it, time it, and keep a backup screen recording.

## P2: stretch
- [ ] Kiosk "Nonna mood": her face changes with margins/stock health.
- [ ] Waste graveyard 🪦: tombstones for expired lots with the $ lost.
- [ ] Phone-sized view of the dashboard (the grandson checks from class).
- [ ] Pitch deck: problem → Grandma's day → live demo → differentiators → what's next.

## Visual direction
- Warm bakery palette (cream, terracotta, espresso brown, sage). The organisers' PDF uses a similar playful warm style, so match it.
- Kiosk: huge, high-contrast, almost empty. Dashboard: clean, dense, factual, with Nonna quotes as small italic flavor text.
- Emoji are our icon set (🥐🍂🥧☕). No icon library needed.

## Gotchas
- Lane 2's hooks are client-only (`"use client"`). Server components can't call them.
- Chrome needs a user gesture before audio/mic. That's what the Start button is for.
- Test the whole demo on **the demo laptop, in Chrome, with the real mic** at least twice before judging.

## Agent kickoff prompt
```
You are working on Lane 4 (The Shop Window) of the Nonna.exe hackathon repo.
Before writing code, read: CLAUDE.md, docs/DESIGN_PHILOSOPHY.md (rules 6–8 especially), docs/ARCHITECTURE.md, docs/roles/lane-4-shop-window.md, docs/DEMO.md, src/lib/types.ts.
Next.js here may differ from what you know: check node_modules/next/dist/docs/ before using unfamiliar APIs.
Only edit files your lane owns. Talk to the backend only via /api/* and the SSE stream; handle 501 responses gracefully.
Order: useApi hook → /pos → /demo clock → /kiosk → /dashboard. After each, run npm run typecheck && npm run lint and tell me what to click to verify it.
```
