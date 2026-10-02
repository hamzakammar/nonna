/**
 * LANE 3: npm run simulate -- --days 21
 * Writes realistic sales history straight into the DB (source: "simulator") so the
 * analytics have something to chew on. Requirements are in docs/roles/lane-3-ledger.md § Simulator:
 *   - opening hours 7:00–18:00, morning coffee peak, lunch peak, Saturday is the busiest day
 *   - Fall Parfait trending UP, Apple Pie trending DOWN (the Gentle Truth demo needs this)
 *   - deterministic: same --seed → same data
 * History sales do NOT consume inventory (otherwise the seeded stock would be gone).
 * Only live sales through recordSale() do.
 */
console.log("TODO(lane3): simulator not implemented yet");
