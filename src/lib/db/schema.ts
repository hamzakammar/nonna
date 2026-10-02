/**
 * SQLite schema. Owned by Lane 1 (Pantry), but every lane reads from it.
 * Columns are snake_case. Each lane maps rows to the camelCase types in `@/lib/types`.
 *
 * Changing a table: add columns freely (with a DEFAULT). To rename or drop one,
 * check with the lanes listed in the comment on that table first.
 * After a change, run `npm run db:reset`.
 */
export const SCHEMA = /* sql */ `
PRAGMA foreign_keys = ON;

-- read by: all lanes
CREATE TABLE IF NOT EXISTS suppliers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  contact          TEXT NOT NULL DEFAULT '',
  lead_time_hours  INTEGER NOT NULL DEFAULT 24,
  is_local         INTEGER NOT NULL DEFAULT 0,
  ramp_card_id     TEXT
);

-- read by: all lanes
CREATE TABLE IF NOT EXISTS ingredients (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  unit             TEXT NOT NULL CHECK (unit IN ('g','ml','pcs')),
  reorder_point    REAL NOT NULL,
  reorder_qty      REAL NOT NULL,
  unit_cost_cents  REAL NOT NULL,
  shelf_life_days  INTEGER NOT NULL,
  supplier_id      TEXT NOT NULL REFERENCES suppliers(id)
);

-- read by: all lanes
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🍰',
  price_cents  INTEGER NOT NULL,
  category     TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1
);

-- every supplier's price per ingredient. ingredients.supplier_id/unit_cost_cents hold the
-- CURRENT pick (cheapest, or local within 10%), kept in sync by inventory/sourcing.ts.
-- written by: pantry. read by: shop window
CREATE TABLE IF NOT EXISTS supplier_offers (
  ingredient_id    TEXT NOT NULL REFERENCES ingredients(id),
  supplier_id      TEXT NOT NULL REFERENCES suppliers(id),
  unit_cost_cents  REAL NOT NULL,
  PRIMARY KEY (ingredient_id, supplier_id)
);

-- Price Watch. written by: pantry. read by: voice, shop window
CREATE TABLE IF NOT EXISTS competitors (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'manual',
  external_id      TEXT UNIQUE,
  website          TEXT,
  last_checked_at  TEXT,
  last_status      TEXT
);

-- Paid-API usage per calendar month, so the free tier is never exceeded (Price Watch's Google provider).
CREATE TABLE IF NOT EXISTS api_usage (
  month  TEXT NOT NULL,  -- "2026-10"
  sku    TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (month, sku)
);

CREATE TABLE IF NOT EXISTS competitor_prices (
  id             TEXT PRIMARY KEY,
  competitor_id  TEXT NOT NULL REFERENCES competitors(id),
  item_name      TEXT NOT NULL,
  price_cents    INTEGER NOT NULL,
  product_id     TEXT REFERENCES products(id),
  observed_at    TEXT NOT NULL,
  source         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS competitor_prices_product ON competitor_prices(product_id, observed_at);

-- read by: pantry (consumption), ledger (margins)
CREATE TABLE IF NOT EXISTS recipe_items (
  product_id     TEXT NOT NULL REFERENCES products(id),
  ingredient_id  TEXT NOT NULL REFERENCES ingredients(id),
  qty_per_unit   REAL NOT NULL,
  PRIMARY KEY (product_id, ingredient_id)
);

-- written by: pantry. read by: voice, shop window
CREATE TABLE IF NOT EXISTS stock_lots (
  id             TEXT PRIMARY KEY,
  ingredient_id  TEXT NOT NULL REFERENCES ingredients(id),
  qty_remaining  REAL NOT NULL,
  received_at    TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  expiring_notified_at  TEXT  -- set when stock.expiring fired, so it fires once per lot
);

-- written by: pantry. read by: voice, shop window, ledger
CREATE TABLE IF NOT EXISTS reorders (
  id                   TEXT PRIMARY KEY,
  ingredient_id        TEXT NOT NULL REFERENCES ingredients(id),
  supplier_id          TEXT NOT NULL REFERENCES suppliers(id),
  qty                  REAL NOT NULL,
  cost_cents           INTEGER NOT NULL,
  reason               TEXT NOT NULL,
  status               TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  placed_at            TEXT,
  received_at          TEXT,
  ramp_transaction_id  TEXT,
  note                 TEXT,
  auto_approved        INTEGER NOT NULL DEFAULT 0  -- placed by the autopilot allowance, no "yes" needed
);

-- written by: pantry. read by: ledger (waste $), shop window
CREATE TABLE IF NOT EXISTS waste_events (
  id             TEXT PRIMARY KEY,
  lot_id         TEXT NOT NULL,
  ingredient_id  TEXT NOT NULL REFERENCES ingredients(id),
  qty            REAL NOT NULL,
  cost_cents     INTEGER NOT NULL,
  reason         TEXT NOT NULL,
  at             TEXT NOT NULL
);

-- written by: ledger. read by: everyone
CREATE TABLE IF NOT EXISTS sales (
  id              TEXT PRIMARY KEY,
  at              TEXT NOT NULL,
  total_cents     INTEGER NOT NULL,
  payment_method  TEXT NOT NULL,
  source          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_at ON sales(at);

CREATE TABLE IF NOT EXISTS sale_items (
  sale_id           TEXT NOT NULL REFERENCES sales(id),
  product_id        TEXT NOT NULL REFERENCES products(id),
  qty               INTEGER NOT NULL,
  unit_price_cents  INTEGER NOT NULL
);

-- written by: ledger (camera counter, optional). read by: ledger
CREATE TABLE IF NOT EXISTS people_counts (
  at     TEXT NOT NULL,
  count  INTEGER NOT NULL
);

-- written by: voice. read by: shop window
CREATE TABLE IF NOT EXISTS notifications (
  id               TEXT PRIMARY KEY,
  at               TEXT NOT NULL,
  kind             TEXT NOT NULL,
  severity         TEXT NOT NULL,
  json             TEXT NOT NULL,  -- full NonnaNotification
  delivered_at     TEXT,
  acknowledged_at  TEXT
);

-- written by: voice. read by: shop window (transcript panel)
CREATE TABLE IF NOT EXISTS voice_log (
  id          TEXT PRIMARY KEY,
  at          TEXT NOT NULL,
  transcript  TEXT NOT NULL,
  intent      TEXT NOT NULL,
  spoken      TEXT NOT NULL
);

-- mock Ramp. written by: pantry (ramp-mock)
CREATE TABLE IF NOT EXISTS ramp_cards (
  id                 TEXT PRIMARY KEY,
  display_name       TEXT NOT NULL,
  last_four          TEXT NOT NULL,
  spend_limit_cents  INTEGER NOT NULL,
  state              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ramp_transactions (
  id                     TEXT PRIMARY KEY,
  card_id                TEXT NOT NULL REFERENCES ramp_cards(id),
  merchant_name          TEXT NOT NULL,
  amount_cents           INTEGER NOT NULL,
  user_transaction_time  TEXT NOT NULL,
  memo                   TEXT,
  receipt_ids            TEXT NOT NULL DEFAULT '[]'
);

-- the make-list. written by: ledger. read by: shop window, voice
--   kind 'morning': the shelf batch, sized by the forecast, created once per day
--   kind 'order':   a sale the shelf couldn't fill, or an order added by hand
CREATE TABLE IF NOT EXISTS prep_tasks (
  id          TEXT PRIMARY KEY,
  day         TEXT NOT NULL,  -- local YYYY-MM-DD
  product_id  TEXT NOT NULL REFERENCES products(id),
  qty         INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('morning','order')),
  note        TEXT NOT NULL DEFAULT '',
  due_at      TEXT,
  sale_id     TEXT,
  created_at  TEXT NOT NULL,
  done_at     TEXT
);
CREATE INDEX IF NOT EXISTS prep_tasks_day ON prep_tasks(day);
`;
