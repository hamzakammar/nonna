import { db, id } from "@/lib/db";
import { nowIso } from "@/lib/clock";
import { bus } from "@/lib/events";
import { template } from "@/lib/voice/persona";
import type { Channel, NonnaNotification, NotificationKind, Severity, VoiceAction, Unit } from "@/lib/types";

export interface NotifyInput {
  kind: NotificationKind;
  severity: Severity;
  text: string;
  awaitingAnswer?: { question: string; onYes: VoiceAction; onNo?: VoiceAction };
  channels?: Channel[];
}

const g = globalThis as unknown as { __nonnaSubscribers?: Set<(n: NonnaNotification) => void>; __nonnaNotifyRegistered?: boolean };
const subscribers = (g.__nonnaSubscribers ??= new Set());

export function notify(input: NotifyInput): NonnaNotification {
  const notification: NonnaNotification = {
    id: id("note"), at: nowIso(), kind: input.kind, severity: input.severity,
    text: input.text, spoken: template(input.kind, input.text),
    awaitingAnswer: input.awaitingAnswer, channels: input.channels ?? ["speaker", "dashboard"], deliveredAt: nowIso(),
  };
  if (notification.awaitingAnswer?.onNo?.type === "snooze" && !notification.awaitingAnswer.onNo.notificationId)
    notification.awaitingAnswer.onNo.notificationId = notification.id;
  db().prepare("INSERT INTO notifications (id, at, kind, severity, json, delivered_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(notification.id, notification.at, notification.kind, notification.severity, JSON.stringify(notification), notification.deliveredAt!);
  for (const listener of subscribers) {
    try { listener(notification); } catch (error) { console.error("[notify] subscriber failed", error); }
  }
  bus.emit("notify", { notification });
  return notification;
}

export function subscribe(listener: (n: NonnaNotification) => void): () => void {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

export function getNotification(notificationId: string): NonnaNotification | undefined {
  const row = db().prepare("SELECT json FROM notifications WHERE id = ?").get(notificationId) as { json: string } | undefined;
  return row ? JSON.parse(row.json) as NonnaNotification : undefined;
}

export function acknowledge(notificationId: string): void {
  const notification = getNotification(notificationId);
  if (!notification || notification.acknowledgedAt) return;
  notification.acknowledgedAt = nowIso();
  db().prepare("UPDATE notifications SET json = ?, acknowledged_at = ? WHERE id = ?")
    .run(JSON.stringify(notification), notification.acknowledgedAt, notificationId);
}

function ingredient(ingredientId: string): { name: string; unit: Unit; supplierName: string } | undefined {
  return db().prepare(`SELECT i.name, i.unit, s.name AS supplierName FROM ingredients i
    JOIN suppliers s ON s.id = i.supplier_id WHERE i.id = ?`).get(ingredientId) as
    { name: string; unit: Unit; supplierName: string } | undefined;
}

function amount(qty: number, unit: Unit): string {
  if (unit === "ml" && qty >= 1000) return `${qty / 1000} litres`;
  return `${qty} ${unit}`;
}

export function registerNotifyListeners(): void {
  if (g.__nonnaNotifyRegistered) return;
  g.__nonnaNotifyRegistered = true;
  bus.on("stock.low", ({ ingredientId, totalQty }) => {
    if (totalQty > 0) return;
    const item = ingredient(ingredientId);
    if (item) notify({ kind: "low_stock", severity: "urgent", text: `We're out of ${item.name}; check the open reorder.` });
  });
  bus.on("reorder.proposed", ({ reorder }) => {
    const item = ingredient(reorder.ingredientId);
    if (!item) return;
    const question = `Should I order ${amount(reorder.qty, item.unit)} of ${item.name} from ${item.supplierName} for $${(reorder.costCents / 100).toFixed(2)}?`;
    notify({ kind: "reorder_proposed", severity: "nudge", text: question,
      awaitingAnswer: { question, onYes: { type: "approve_reorder", reorderId: reorder.id }, onNo: { type: "snooze", notificationId: "", minutes: 10 } } });
  });
  bus.on("stock.expiring", ({ ingredientId, expiresAt }) => {
    const item = ingredient(ingredientId);
    if (item) notify({ kind: "expiring", severity: "nudge", text: `${item.name} expires ${expiresAt}. Use it soon.` });
  });
  bus.on("stock.expired", ({ waste }) => {
    const item = ingredient(waste.ingredientId);
    if (item) notify({ kind: "expired", severity: "info", text: `${amount(waste.qty, item.unit)} of ${item.name} expired, costing $${(waste.costCents / 100).toFixed(2)}; review the next prep plan.` });
  });
  bus.on("reorder.placed", ({ reorder }) => {
    const item = ingredient(reorder.ingredientId);
    if (item) notify({ kind: "reorder_placed", severity: "info", text: `Ordered ${amount(reorder.qty, item.unit)} of ${item.name}.` });
  });
  bus.on("reorder.received", ({ reorder }) => {
    const item = ingredient(reorder.ingredientId);
    if (item) notify({ kind: "delivery_arrived", severity: "info", text: `${amount(reorder.qty, item.unit)} of ${item.name} arrived.` });
  });
}
