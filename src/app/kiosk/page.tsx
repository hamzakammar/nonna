"use client";
// Lane 4. Grandma's home screen: Nonna says hello, five big doors. Spec: docs/roles/lane-4-shop-window.md § Kiosk
import Link from "next/link";
import type { Reorder } from "@/lib/types";
import { NonnaSays } from "@/components/Nonna";
import { useApi } from "@/components/useApi";

function greeting(iso?: string) {
  const h = iso ? new Date(iso).getHours() : 9;
  if (h < 12) return "Buongiorno";
  if (h < 17) return "Buon pomeriggio";
  return "Buonasera";
}

const DOORS = [
  { href: "/kiosk/orders", emoji: "📦", title: "Orders to check", note: "I get them ready, you say yes", color: "bg-terracotta" },
  { href: "/kiosk/pantry", emoji: "🧺", title: "My pantry", note: "What's on the shelves", color: "bg-sky" },
  { href: "/kiosk/menu", emoji: "🍰", title: "My menu", note: "See or remove treats", color: "bg-sage" },
  { href: "/kiosk/business", emoji: "📊", title: "How's the shop?", note: "Best sellers and busy times", color: "bg-butter-deep" },
];

export default function Kiosk() {
  const clock = useApi<{ now: string }>("/api/sim");
  const reorders = useApi<Reorder[]>("/api/reorders", { pollMs: 5000 });
  const waiting = reorders.status === "ok" ? reorders.data.filter((r) => r.status === "proposed").length : 0;
  const now = clock.status === "ok" ? clock.data.now : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 sm:px-8">
      <NonnaSays size={150} mood={waiting ? "happy" : "proud"}>
        {greeting(now)}, tesoro!{" "}
        {waiting === 0
          ? "Everything is taken care of. 💛"
          : `${waiting} ${waiting === 1 ? "order needs" : "orders need"} your yes.`}
      </NonnaSays>

      <div className="grid gap-6 sm:grid-cols-2">
        {DOORS.map((d) => (
          <Link key={d.href} href={d.href} className={`toon relative flex items-center gap-5 p-6 transition-transform hover:-translate-y-1 hover:rotate-[-0.5deg] ${d.color}`}>
            <span aria-hidden className="text-[84px] leading-none">{d.emoji}</span>
            <span>
              <span className="font-display block text-[34px] font-bold leading-tight">{d.title}</span>
              <span className="block text-[22px] font-semibold">{d.note}</span>
            </span>
            {d.href === "/kiosk/orders" && waiting > 0 && (
              <span className="pop-in absolute -right-3 -top-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-cocoa bg-berry font-display text-[32px] font-bold text-white">
                {waiting}
              </span>
            )}
          </Link>
        ))}
      </div>

      <Link href="/kiosk/menu/new" className="big-btn self-center bg-white text-[34px]">
        <span aria-hidden>➕</span> Add a new treat
      </Link>
    </main>
  );
}
