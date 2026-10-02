/** npm run db:reset: wipe the local DB and re-seed the catalogue + stock. */
import { rmSync } from "node:fs";
import { DB_PATH } from "../src/lib/db";
import { seed } from "../src/lib/db/seed";

for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
seed();
console.log(`Seeded ${DB_PATH}`);
