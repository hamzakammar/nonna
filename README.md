# Nonna.exe 👵

**A voice-first back office that lives in Grandma's bakery.** Sales quietly eat inventory through recipes. When something runs low or goes bad, Nonna *asks Grandma out loud* whether to reorder, and a spoken "yes" does it. She also tracks what's selling, when the shop gets busy, and how much to bake tomorrow. And she tells Grandma, gently, when the apple pie needs a little love.

## Quickstart
```bash
npm install
npm run db:reset                         # fresh SQLite DB with catalogue + stock
npm run simulate -- --days 21 --seed 42  # sales history (Lane 3, coming soon)
npm run dev                              # http://localhost:3000
```
Requires **Node ≥ 22.13** (we use the built-in `node:sqlite`) and **Chrome** for voice.
Copy `.env.example` → `.env.local` to add keys. Everything works without them.

| Page | For |
|---|---|
| `/kiosk` | Grandma: the tablet in the bakery |
| `/dashboard` | The grandson: inventory, reorders, analytics |
| `/pos` | Mock till (stands in for the Verifone) |
| `/demo` | Presenter: demo clock and story buttons |

## 👋 New here? Read in this order
1. [`docs/CHARTER.md`](docs/CHARTER.md): what we're building, what we're not, the timeline. **Sign it.**
2. [`docs/DESIGN_PHILOSOPHY.md`](docs/DESIGN_PHILOSOPHY.md): the rules that settle every argument.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the pieces fit, the API and the events.
4. Your lane:
   - 🧺 [Lane 1: The Pantry](docs/roles/lane-1-pantry.md) (inventory, expiry, reorders, mock Ramp)
   - 🗣️ [Lane 2: The Voice](docs/roles/lane-2-voice.md) (wake word, STT/TTS, intents, persona, notifications)
   - 📈 [Lane 3: The Ledger](docs/roles/lane-3-ledger.md) (sales, simulator, analytics, busyness)
   - 🪟 [Lane 4: The Shop Window](docs/roles/lane-4-shop-window.md) (kiosk, dashboard, till, demo)
5. [`docs/DEMO.md`](docs/DEMO.md): the 3-minute story everything builds toward.

Find your open work: `grep -rn 'todo("lane1' src` (or `lane2`, …) and the checkboxes in your role doc.

Link: [here](nonna.hamzaammar.ca/kiosk)

## Scripts
| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run db:reset` | Wipe + re-seed `data/nonna.db` |
| `npm run simulate` | Generate sales history |
| `npm run typecheck` / `npm run lint` | Run both before every push |
