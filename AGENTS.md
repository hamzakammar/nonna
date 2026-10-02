<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nonna.exe: rules for every coding agent

You are helping one of four people build **Nonna.exe** at a hackathon. Four lanes work in parallel in this repo, so staying aligned matters more than being clever.

## Before you write any code, read
1. `docs/DESIGN_PHILOSOPHY.md`: product rules + engineering rules (non-negotiable)
2. `docs/ARCHITECTURE.md`: folders, ownership, API, events
3. Your human's role doc in `docs/roles/` (ask which lane if it's not clear)
4. `src/lib/types.ts`: the shared contract

## Hard rules
- **Only edit files your lane owns** (listed at the top of each role doc). Use other lanes only via their exported public functions, `/api/*` routes or event-bus events, never their internals.
- **Do not change `src/lib/types.ts` or `src/lib/db/schema.ts` in a breaking way** (rename/remove/make required). Additive changes are OK. Tell your human so they can tell the team.
- **Time:** `now()` from `@/lib/clock`, never `Date.now()` / `new Date()` for business logic.
- **Money:** integer cents. **Quantities:** base units (g / ml / pcs).
- **The LLM never produces numbers** that reach Grandma. Code computes, Nonna phrases.
- **Must run with zero API keys.** Every AI feature has a deterministic fallback.
- Server-only modules (`@/lib/db`, `inventory`, `pricewatch`, `sales`, `analytics`, `notify`, `voice/intents`) are never imported from `"use client"` files.
- Unbuilt functions call `todo("laneN …")` and routes map that to 501. Keep that pattern, and handle 501s gracefully in UI.
- No new dependencies without telling your human. No native modules.
- Before saying a task is done: `npm run typecheck && npm run lint`, and prove the role doc's "Done when" criterion.
- Work through your role doc's P0 list in order. Don't start P1/P2 unless your human says so.
