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
  /** Average use per day over the last 7 days of sales (base units). Absent with no sales history. */
  dailyUsage?: number;
  /** totalQty / dailyUsage. Absent with no sales history. */
  daysOfCover?: number;
  /** When stock hits 0 at the current pace (demo clock). */
  runsOutAt?: string;
}

/** One supplier's price for one ingredient. An ingredient can have several. */
export interface SupplierOffer {
  supplierId: string;
  ingredientId: string;
  unitCostCents: number;
}

/** Result of a supplier price change (the "trade war" demo). All numbers are computed, so Nonna can say them as-is. */
export interface PriceChange {
  ingredientId: string;
  ingredientName: string;
  supplierId: string;
  supplierName: string;
  oldUnitCostCents: number;
  newUnitCostCents: number;
  pctChange: number; // +36 = 36% more expensive
  /** Who we buy from, before and after. Different if the change made someone else the better pick. */
  before: { supplierId: string; supplierName: string; unitCostCents: number };
  after: { supplierId: string; supplierName: string; unitCostCents: number; reason: SourcingReason };
  /** Margin impact on every product that uses this ingredient, at the cost we'll actually pay. */
  products: {
    productId: string;
    name: string;
    priceCents: number;
    oldCostCents: number;
    newCostCents: number;
    oldMarginPct: number;
    newMarginPct: number;
    unitsLast7Days: number;
    /** Extra cost per week at last week's sales (negative = saving). The number Nonna should lead with. */
    weeklyImpactCents: number;
  }[];
  weeklyImpactCents: number; // sum over products
}

export type SourcingReason = "only_option" | "cheapest" | "local_within_10pct";

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
  /** Why this supplier and this qty, in plain words, e.g. "Maple Hill Creamery (local, 7% more than Gerald's Dairy) · ~5 days of cover". */
  note?: string;
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

// ---------- Price Watch (competitor prices) ----------

export interface Competitor {
  id: string;
  name: string; // "The Bakery"
}

/** One observed price on a competitor's menu, matched (if we can) to one of our products. */
export interface CompetitorPrice {
  id: string;
  competitorId: string;
  itemName: string; // as written on their menu: "Pumpkin Spice Parfait"
  priceCents: number;
  productId?: string; // our closest product, if any
  observedAt: string;
  source: "mock" | "photo" | "voice" | "manual";
}

export type PriceAction =
  | "undercut" // we're pricier or level, and can go 25¢ under them and keep our margin floor
  | "raise" // we're well under them: raise and still be cheaper
  | "hold" // already a bit cheaper; leave it
  | "cant_undercut"; // going under them would break our margin floor: compete on quality instead

/** Computed pricing advice for one product. Every number is exact; Nonna only rewords `reason`. */
export interface PriceAdvice {
  productId: string;
  name: string;
  competitorId: string;
  competitorName: string;
  theirItemName: string;
  theirPriceCents: number;
  ourPriceCents: number;
  unitCostCents: number; // ingredient cost at today's supplier prices
  marginPctNow: number;
  floorPriceCents: number; // lowest price that keeps the margin floor
  action: PriceAction;
  suggestedPriceCents?: number; // for undercut / raise
  marginPctAtSuggested?: number;
  reason: string; // factual, e.g. "The Bakery: $7.95. Ours: $7.50 (72.8% margin). Floor at 60%: $5.10."
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
  | "daily_summary"
  | "card_declined"
  | "price_changed"
  | "competitor_prices";

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
  /** "Should I drop the Fall Parfait to $7.70?" → yes */
  | { type: "set_price"; productId: string; priceCents: number }
  /** "Gerald's card is maxed, raise it to $700 and order?" → yes */
  | { type: "raise_card_limit"; cardId: string; newLimitCents: number; thenApproveReorderId?: string }
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
  /** Grandma approved, but the card said no. Nonna offers to raise the limit (suggestedLimitCents). */
  "card.declined": {
    reorder: Reorder;
    cardId: string;
    reason: "suspended" | "over_limit";
    weeklySpendCents: number;
    spendLimitCents: number;
    suggestedLimitCents?: number; // only for over_limit
  };
  "price.changed": { change: PriceChange };
  /** New competitor prices came in (photo / voice / manual). `advice` holds only actionable items (undercut / raise). */
  "competitor.prices": { competitorId: string; prices: CompetitorPrice[]; advice: PriceAdvice[] };
  notify: { notification: NonnaNotification };
  "clock.changed": { now: string };
}
