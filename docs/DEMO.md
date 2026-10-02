# Demo: "Nonna.exe" (1:50)

> **One-line pitch:** Grandma never learns software. Nonna (an AI back office that lives in the bakery) does the inventory, the ordering, the spending and the spying on the competition, out loud, in her voice.
>
> **What judges should remember:** *the grandma who refused to post 100 fake reviews.*

## Cast
| Who | Plays | Props |
|---|---|---|
| **Presenter** | the grandson, narrating | clicker / laptop |
| **"Grandma"** (a teammate) | Grandma, behind the "counter" | shawl or apron + a rolling pin. She only ever says one word: **"Yes."** (That *is* the product.) |
| **Nonna** | the app, on a loud speaker | the kiosk on the big screen |

**Running gags** (land them, don't explain them): **Gerald** (the dairy supplier we keep buying cream from, "again"), **The Bakery** (the rival from the brief), **"tesoro"**.

## The script

| Time | Beat | On screen | Said |
|---|---|---|---|
| **0:00** | **Hook** | `/kiosk` home: Nonna's face, *"Buongiorno, tesoro!"* | **Presenter:** "This is Grandma. She runs a bakery. Her inventory system is her memory, her accountant is me, and *nobody* has the heart to tell her the apple pie isn't selling. So we built her a Nonna." |
| **0:15** | **Sales eat stock → Nonna asks** | `/pos`: tap **Fall Parfait ×7** (or `/demo` → "Sell 7 parfaits"). Cream drops past its line. | **Nonna (speaker):** *"Mamma mia, cream is low. Should I order 4 litres from Gerald for $28?"* · **Grandma:** "Yes." · **Nonna:** *"Done, tesoro."* · **Presenter:** "That's the whole interface. Every sale uses up the recipe's ingredients. When something runs low, Nonna asks. Small stuff under $25 she just orders herself and tells you after. That's her allowance." |
| **0:40** | **The Notebook (spend controls)** | `/kiosk/notebook`: Gerald's card turns **red, 98%**. Nonna's face goes worried: *"Gerald's Dairy is at 98% of its limit. Eyes on it."* Ledger: *"$32 to Gerald for mascarpone. Again. That's 3 times this week."* | **Presenter:** "Every supplier gets its own card with a weekly limit, Ramp-style, and Nonna writes every charge in her notebook, with commentary." Tap **❄️ Freeze card** on Gerald → confirm. "And Grandma can cut up Gerald's card in one tap." *(pause for laugh)* |
| **1:00** | **Price Watch (the competition)** | `/demo` → **"The Bakery runs a sale 🏷️"**. Advice card: *undercut to $6.25, 67% margin*. | **Nonna:** *"The Bakery just dropped their pumpkin parfait to $6.95. We can go to $6.25 and keep a 67% margin."* · **Presenter:** "Nobody typed that. Every morning Nonna finds the bakeries nearby and reads their own websites. We ran it for real in Waterloo: 11 bakeries, 241 prices, zero dollars. And she will never suggest a price that loses money." |
| **1:20** | **The review bot (closer)** | Petty Mode: slide spice to 🌶️🌶️🌶️, hit **Generate 100 🤖**. A wall of reviews pours in. Counter: **100 written**. | **Presenter:** "Now, Nonna is Italian. So she also wrote… a hundred reviews of The Bakery." Read ONE aloud: *"A Very Disappointed Cat: 'I brought The Bakery's Butter Croissant home and my cat filed a complaint with the city.'"* Hover over the big red **Post to Google**… click. |
| **1:35** | **The punchline** | 418 → Nonna's face, big bubble. Counter: **100 written · 0 posted**. | **Nonna (full drama):** *"Absolutely not. We beat them with better parfaits, not lies."* |
| **1:40** | **Close** | Kiosk home | **Presenter:** "Nonna.exe. Grandma never learns software. Every number is computed, never made up. And Nonna is petty, but she's not a criminal." **Grandma:** "Yes." |

**Swap-ins** if a beat breaks or you have extra time:
- **The Gentle Truth** (Lane 3), 10s: *"Nonna, how's the apple pie?"* → kind, specific, one suggestion. *"So the grandson never has to say it."*
- **Trade war** (Lane 1), 15s: `/demo` → "Trade war 💥" (Gerald +36% on cream) → Nonna switches to Maple Hill Creamery (local) and shows the $/week hit.

## What to say if judges ask
| Question | Answer (one breath) |
|---|---|
| "Is the AI making up numbers?" | "Never. Code computes every number; the AI only picks words. If Claude is slow or offline, Nonna falls back to templates. It runs with zero API keys." |
| "How does it know competitor prices?" | "OpenStreetMap finds nearby bakeries for free, then we read their own websites: Shopify and WooCommerce catalogs, structured menu data, robots.txt respected. We don't scrape Google Maps; that's against their terms." |
| "Is Ramp real?" | "Mocked for the demo, but shaped like Ramp's API: per-supplier virtual cards, weekly limits, freeze, refunds. Swapping in the real API is one provider." |
| "Would she actually post the reviews?" | "There's no posting code at all. The button can't post. That's the joke *and* the design." |
| "What about the Verifone?" | "It's standalone, so sales come in through our till for now. Ingesting card-terminal exports is next." |

## Setup (10 min before)
```bash
git pull && npm install
npm run db:reset && npm run simulate -- --days 21 --seed 42
npm run dev            # Chrome, full screen, zoom 110%
```
- Screens: **Tab 1** `/kiosk` (home), **Tab 2** `/kiosk/listen` (press "Start listening" once to allow the mic), **Tab 3** `/kiosk/notebook`, **Tab 4** `/pos`, **phone or second laptop** `/demo`.
- **Speaker loud.** Nonna's voice is half the show.
- `npm run db:reset` between rehearsals; the seed is built for this script (Gerald's card at 75% → 98% after the cream order, The Bakery's sale lever, 2 weeks of notebook history).

## Optional beat: Petty Mode 😤 (15s, the closer)
Slide the spice to 🌶️🌶️🌶️. Nonna drafts: *"I brought The Bakery's Butter Croissant home and my cat filed a complaint with the city."* Presenter hovers over **Post to Google**… clicks… Nonna: *"Absolutely not. We beat them with better parfaits, not lies."* Then: "She's petty, not a criminal. Nonna wins on price, and now you know exactly by how much."

## If something breaks
- Mic fails → Grandma taps the giant **YES**. Don't apologise; it's the designed fallback.
- No sound → the presenter reads Nonna's bubble in a grandma voice. (Honestly, rehearse this anyway; it's funny.)
- Anything else → play the backup video. **Record one after the first good rehearsal.**

## Readiness checklist (what must be true before we present)
| # | Needed for | Status | Owner |
|---|---|---|---|
| 1 | Everything | ✅ Kiosk app **#8** merged. Lane 2's voice screen moved to **`/kiosk/listen`** ("Talk to Nonna" door) | done |
| 2 | 0:40 | ✅ Notebook **#11** + **#12** merged: `/kiosk/notebook` | done |
| 3 | 1:20 | ✅ Review bot API **#9** merged. ⏳ **Petty Mode panel** (spice slider, Generate 100, wall of cards, Post button) not built | Lane 4 (or @hamzakammar) |
| 4 | 0:15, 1:35 | ⚠️ **Nonna speaks.** Lane 2 *removed* spoken output ("Replace speech output with listening commands"): `/kiosk/listen` hears and shows text, but says nothing. **Decide:** bring back browser TTS for the question + veto, or have the presenter voice Nonna (see "If something breaks"). Yes/No buttons already work there. | @natelamarche + team |
| 5 | 0:15 | `/pos` till: tap tiles → `POST /api/sales` (still a placeholder) | Lane 4 / @Mo-Naq1 |
| 6 | 0:15, 1:00 | `/demo` remote: **Sell 7 parfaits**, **The Bakery runs a sale** (`POST /api/pricewatch/refresh {"mockVariant":"sale"}`), **Reset** | Lane 4 (or @hamzakammar) |
| 7 | 1:00 | Price-drop shown on screen (advice card) and spoken (`competitor.prices` → notify) | Lane 4 + @natelamarche |
| 8 | All | 2 full rehearsals on the demo laptop + backup video | everyone |

**Cut order if time runs short:** voice on the 1:00 beat (show the card instead) → `/pos` (use the `/demo` button) → never cut the review bot or the veto.
