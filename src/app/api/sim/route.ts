// Lane 4. Demo controls. GET → current demo time.
// POST { advanceHours } | { reset: true } (clock back to real time) | { resetWorld: true } (empty every table, re-seed, clock reset)
import { handle } from "@/lib/api";
import { advance, nowIso, reset, HOUR } from "@/lib/clock";
import { db } from "@/lib/db";
import { seed } from "@/lib/db/seed";

/** `npm run db:reset` without deleting the file, so it works while the server holds the database open. */
function resetWorld(): void {
  reset();
  const conn = db();
  const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => String(r.name));
  conn.exec("PRAGMA foreign_keys = OFF");
  try {
    conn.exec("BEGIN");
    for (const t of tables) conn.exec(`DELETE FROM "${t.replaceAll('"', '""')}"`);
    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  } finally {
    conn.exec("PRAGMA foreign_keys = ON");
  }
  seed();
}

export async function GET() {
  return handle(() => ({ now: nowIso() }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { advanceHours?: number; reset?: boolean; resetWorld?: boolean };
  return handle(() => {
    if (body.resetWorld) resetWorld();
    if (body.reset) reset();
    if (body.advanceHours) advance(body.advanceHours * HOUR);
    return { now: nowIso() };
  });
}
