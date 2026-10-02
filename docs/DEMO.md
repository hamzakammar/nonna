# Demo script (3 minutes)

Owner: Lane 4. Rehearse it at least twice on the demo laptop in Chrome with the real mic, and record a backup video.

## Setup (before judges arrive)
```bash
npm run db:reset && npm run simulate -- --days 21 --seed 42 && npm run dev
```
- Tab 1: `/kiosk` (fullscreen, "Start Nonna" tapped). Tab 2: `/dashboard`. Tab 3: `/pos`. Phone/laptop 2: `/demo`.
- Speaker volume up. Grandma's phone shows Messenger, if P1 shipped.

## Script

| Time | Beat | What's shown / said |
|---|---|---|
| 0:00 | **Hook** | "This is Grandma. She runs a bakery, and her inventory system is her memory. We gave her a helper she never has to learn." |
| 0:20 | **Sales eat stock** | Tap 7 Fall Parfaits on `/pos`. The dashboard shows cream dropping live. |
| 0:40 | **Nonna speaks** | Kiosk: *"Mamma mia, cream is low… Should I order 4 litres from Gerald for $28?"* Presenter-as-Grandma: **"Yes."** → *"Done, tesoro."* The dashboard shows the reorder placed on Gerald's card. |
| 1:10 | **Ask anything** | "Nonna, what's selling best this week?" → real numbers from the analytics. |
| 1:30 | **The Gentle Truth** | "Nonna, how's the apple pie doing?" → kind, specific, one suggestion. *"So the grandson never has to say it."* |
| 1:55 | **Rush-aware** | `/demo` → "Fire a rush". Rush meter goes red. Press "+1 day": berries expire, **Nonna stays quiet**. Rush ends → *"Okay, it's calm. Two things while you were busy…"* |
| 2:25 | **Analytics** | Dashboard: busyness heatmap, "bake tomorrow" list, waste $. |
| 2:45 | **Close** | "Zero screens for Grandma. Every number computed, never made up. Spend tracked on every supplier card." |

## If something breaks
- Mic fails → use the YES/NO buttons and keep going. Don't apologise; that's the fallback working as designed.
- Claude is slow → the fallback template voice still speaks. Keep going.
- Everything is on fire → play the backup video.
