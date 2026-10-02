/**
 * Database handle. Uses Node's built-in `node:sqlite`, so there are no native
 * deps to compile at a hackathon. Server-only: never import this from a
 * "use client" file.
 *
 *   import { db, id } from "@/lib/db";
 *   const rows = db().prepare("SELECT * FROM products WHERE active = 1").all();
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SCHEMA } from "./schema";

const DB_PATH = process.env.NONNA_DB_PATH ?? path.join(process.cwd(), "data", "nonna.db");

const g = globalThis as unknown as { __nonnaDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__nonnaDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    conn.exec("PRAGMA journal_mode = WAL;");
    conn.exec(SCHEMA);
    g.__nonnaDb = conn;
  }
  return g.__nonnaDb;
}

/** Run `fn` in a transaction (rolls back if it throws). */
export function tx<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

/** Short prefixed ids that are readable in logs: id("sale") -> "sale_3f9a1c2b". */
export function id(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export { DB_PATH };
