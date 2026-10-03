/**
 * LANE 3: npm run simulate -- --days 21 --seed 42
 * Fills the DB with realistic sales history. The logic lives in src/lib/sales/simulate.ts,
 * so the demo's "Reset world" button can run exactly the same thing.
 */
import { simulateHistory } from "../src/lib/sales/simulate";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? NaN : Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}

const days = arg("days", 21);
const seed = arg("seed", 42);
const { sales, items } = simulateHistory({ days, seed });
console.log(`Simulated ${sales} sales (${items} items) over ${days} days, seed ${seed}.`);
