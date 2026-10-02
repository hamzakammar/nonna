/**
 * SHARED CONTRACT — every lane codes against these types.
 *
 * Changing anything here affects all four people. Rules:
 *   1. Adding a new optional field or a new type is OK. Post it in team chat.
 *   2. Renaming or removing a field, or making one required, needs a 👍 from the
 *      lane(s) that use it first.
 *
 * Units, everywhere, no exceptions:
 *   - Money: integer cents (`priceCents: 450` = $4.50). Never floats.
 *   - Quantities: base units. Grams for solids, millilitres for liquids,
 *     "pcs" for countable things (eggs, cups, boxes).
 *   - Time: ISO-8601 strings in the DB/API. Get "now" from `@/lib/clock`,
 *     never from `Date.now()`.
 */

// ---------- Catalogue ----------

export type Unit = "g" | "ml" | "pcs";

export interface Supplier {
  id: string;
  name: string; // "Gerald's Dairy"
  contact: string; // phone/email, display only
  leadTimeHours: number; // how long an order takes to arrive
  isLocal: boolean;
  rampCardId?: string; // mock Ramp virtual card used to pay this supplier
}

export interface Ingredient {
  id: string;
  name: string; // "Heavy cream"
  unit: Unit;
  reorderPoint: number; // when total stock reaches this (base units), propose a reorder
  reorderQty: number; // default amount to order (base units)
  /** Cost of ONE base unit in cents. May be fractional (butter ≈ 1.2¢/g). Math.round() only when you store a money total. */
  unitCostCents: number;
  shelfLifeDays: number; // used to set expiresAt on received stock
  supplierId: string;
}

export interface Product {
  id: string;
  name: string; // "Apple pie (slice)"
  emoji: string; // used by the kiosk/POS tiles
  priceCents: number;
  category: "parfait" | "pie" | "pastry" | "drink" | "other";
  active: boolean;
}

/** How much of each ingredient one unit of a product uses. */
export interface RecipeItem {
  productId: string;
  ingredientId: string;
  qtyPerUnit: number; // base units
}

// ---------- Inventory ----------

/** A batch of one ingredient that arrived together and expires together. Consumed FIFO. */
export interface StockLot {
  id: string;
  ingredientId: string;
  qtyRemaining: number;
  receivedAt: string;
  expiresAt: string;
}

export type StockLevel = "ok" | "low" | "out";

/** What GET /api/inventory returns per ingredient. */
export interface IngredientStatus {
  ingredient: Ingredient;
  totalQty: number;
  level: StockLevel;
  nextExpiry?: string; // soonest expiresAt among lots with qty > 0
  expiringSoonQty: number; // qty expiring within 24h (demo clock)
  openReorderId?: string; // so we never double-order
}

export type ReorderStatus =
  | "proposed" // system wants to order, waiting for Nonna's "yes"
  | "placed" // approved + paid through (mock) Ramp
  | "received" // arrived, turned into a StockLot
  | "cancelled";

export type ReorderReason = "low_stock" | "expired" | "forecast" | "manual";

export interface Reorder {
  id: string;
  ingredientId: string;
  supplierId: string;
  qty: number;
  costCents: number;
  reason: ReorderReason;
  status: ReorderStatus;
  createdAt: string;
  placedAt?: string;
  receivedAt?: string;
  rampTransactionId?: string;
  /** true = Nonna's autopilot placed it without asking (routine + under the allowance). Grandma can still cancel it. */
  autoApproved?: boolean;
}

export interface WasteEvent {
  id: string;
  lotId: string;
  ingredientId: string;
  qty: number;
  costCents: number;
  reason: "expired" | "spoiled" | "dropped";
  at: string;
}

// ---------- Sales ----------

export type PaymentMethod = "card" | "cash";

export interface SaleItem {
  productId: string;
  qty: number;
  unitPriceCents: number;
}

export interface Sale {
  id: string;
  at: string;
  items: SaleItem[];
  totalCents: number;
  paymentMethod: PaymentMethod;
  source: "pos" | "simulator" | "voice";
}

/** Body of POST /api/sales */
export interface RecordSaleInput {
  items: { productId: string; qty: number }[];
  paymentMethod: PaymentMethod;
  source?: Sale["source"];
  at?: string; // simulator may backdate; defaults to clock.now()
}

// ---------- Analytics ----------

export type Trend = "rising" | "steady" | "falling";

export interface ProductPerformance {
  productId: string;
  name: string;
  unitsSold: number;
  revenueCents: number;
  marginCents: number; // revenue − ingredient cost
  trend: Trend;
  rank: number; // 1 = best seller in range
  verdict: "star" | "solid" | "struggling"; // feeds the Gentle Truth
}

/** One cell of the busyness heatmap. */
export interface BusynessBucket {
  dayOfWeek: number; // 0 = Sunday
  hour: number; // 0–23
  salesPerHour: number;
  peopleAvg?: number; // only when the camera counter is running
  level: 0 | 1 | 2 | 3 | 4; // 0 = dead, 4 = slammed
}

export interface RushStatus {
  now: BusynessBucket["level"];
  label: "quiet" | "steady" | "busy" | "rush";
  nextRushAt?: string; // predicted
}

export interface PrepSuggestion {
  productId: string;
  name: string;
  suggestedQty: number; // how many to make for the target day
  basis: string; // human-readable reason, e.g. "avg of last 3 Saturdays"
}

/** A kind, specific piece of feedback about one product (the Gentle Truth). */
export interface GentleTruth {
  productId: string;
  facts: string; // computed numbers in plain words. The LLM may rephrase these but may never change them.
  suggestion: string; // something actionable
  spoken?: string; // Nonna-voiced version (filled by the voice lane)
}

// ---------- Notifications & voice ----------

export type Severity = "info" | "nudge" | "urgent";

export type NotificationKind =
  | "low_stock"
  | "expiring"
  | "expired"
  | "reorder_proposed"
  | "reorder_placed"
  | "delivery_arrived"
  | "rush_incoming"
  | "gentle_truth"
  | "daily_summary";

export type Channel = "speaker" | "dashboard" | "messenger";

export interface NonnaNotification {
  id: string;
  at: string;
  kind: NotificationKind;
  severity: Severity;
  /** Plain factual text, always correct. */
  text: string;
  /** What Nonna actually says out loud (persona-styled). Falls back to `text`. */
  spoken?: string;
  /** If set, Nonna asks a yes/no question and the answer triggers this. */
  awaitingAnswer?: { question: string; onYes: VoiceAction; onNo?: VoiceAction };
  channels: Channel[];
  deliveredAt?: string;
  acknowledgedAt?: string;
}

/** Things the voice layer is allowed to make happen. Keep this list small. */
export type VoiceAction =
  | { type: "approve_reorder"; reorderId: string }
  | { type: "cancel_reorder"; reorderId: string }
  | { type: "order_now"; ingredientId: string; qty?: number }
  | { type: "mark_received"; reorderId: string }
  | { type: "log_waste"; ingredientId: string; qty: number }
  | { type: "snooze"; notificationId: string; minutes: number }
  | { type: "none" };

/** Body/response of POST /api/voice */
export interface VoiceRequest {
  transcript: string;
  pendingNotificationId?: string; // the question Nonna just asked, if any
}

export interface VoiceResponse {
  spoken: string; // what to say back, persona-styled
  action: VoiceAction; // already executed server-side by the time this returns
  intent: string; // e.g. "ask_stock", "approve", "ask_sales"
}

// ---------- Mock Ramp (shapes loosely follow Ramp's Developer API) ----------

export interface RampCard {
  id: string;
  displayName: string; // "Gerald's Dairy card"
  lastFour: string;
  spendLimitCents: number;
  state: "ACTIVE" | "SUSPENDED" | "TERMINATED";
}

export interface RampTransaction {
  id: string;
  cardId: string;
  merchantName: string;
  amountCents: number;
  userTransactionTime: string;
  memo?: string;
  receiptIds: string[];
}

// ---------- Events (in-process bus, see src/lib/events.ts) ----------

export interface EventMap {
  "sale.recorded": { sale: Sale };
  "stock.low": { ingredientId: string; totalQty: number };
  "stock.expiring": { lotId: string; ingredientId: string; expiresAt: string };
  "stock.expired": { waste: WasteEvent };
  "reorder.proposed": { reorder: Reorder };
  "reorder.placed": { reorder: Reorder; transaction: RampTransaction };
  "reorder.received": { reorder: Reorder; lot: StockLot };
  "rush.changed": { status: RushStatus };
  "insight.ready": { truths: GentleTruth[] };
  notify: { notification: NonnaNotification };
  "clock.changed": { now: string };
}
