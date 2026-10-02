"use client";
// Lane 4. Grandma's home screen (design/home.html): Nonna's line as the headline, six doors, add a treat.
// Voice comes from Lane 2's useNonnaEars + /api/voice (see NonnaVoice).
import Link from "next/link";
import type { PrepTask, Reorder } from "@/lib/types";
import { NonnaVoice } from "@/components/NonnaVoice";
import { Icon, IconDot, type IconName, type TINTS } from "@/components/icons";
import { useApi } from "@/components/useApi";

function greeting(iso?: string) {
  const h = iso ? new Date(iso).getHours() : 9;
  if (h < 12) return "Buongiorno";
  if (h < 17) return "Buon pomeriggio";
  return "Buonasera";
}

type Door = { href: string; icon: IconName; tint: keyof typeof TINTS; title: string; note: string };

function Leaf({ size, color, edge, className }: { size: number; color: string; edge: string; className: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={`pointer-events-none absolute opacity-90 ${className}`}>
      <path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" fill={color} stroke={edge} strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M4 20L15 9M9 15h5M9 15V10" fill="none" stroke={edge} strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Kiosk() {
  const clock = useApi<{ now: string }>("/api/sim");
  const reorders = useApi<Reorder[]>("/api/reorders", { pollMs: 5000 });
  const next = useApi<PrepTask | null>("/api/sales/todo?next=1", { pollMs: 5000 });
  const waiting = reorders.status === "ok" ? reorders.data.filter((r) => r.status === "proposed").length : 0;
  const now = clock.status === "ok" ? clock.data.now : undefined;
  const nextTask = next.status === "ok" ? next.data : null;

  const idle =
    waiting === 0
      ? `${greeting(now)}! Everything is taken care of.`
      : `${waiting} ${waiting === 1 ? "order needs" : "orders need"} your yes.`;

  const doors: Door[] = [
    { href: "/kiosk/orders", icon: "box", tint: "rust", title: "Orders to check", note: "I get them ready, you say yes" },
    {
      href: "/kiosk/bake", icon: "hat", tint: "rose", title: "Today's baking",
      note: next.status !== "ok" ? "Your list for today" : nextTask ? `Next: ${nextTask.qty} × ${nextTask.name}` : "All done for today!",
    },
    { href: "/kiosk/pantry", icon: "jar", tint: "gold", title: "My pantry", note: "What's on the shelves" },
    { href: "/kiosk/menu", icon: "dome", tint: "olive", title: "My menu", note: "See or remove treats" },
    { href: "/kiosk/business", icon: "bars", tint: "rose", title: "How's the shop?", note: "Best sellers and busy times" },
    { href: "/kiosk/notebook", icon: "notebook", tint: "gold", title: "My notebook", note: "Where the money went" },
  ];

  return (
    <main className="relative mx-auto flex w-[1194px] max-w-full flex-1 flex-col gap-7 px-14 pb-9 pt-[34px]">
      <Leaf size={120} color="#e3b04b" edge="#a9781c" className="right-11 top-[32px] rotate-[18deg]" />
      <Leaf size={72} color="#c8642c" edge="#8a3f14" className="right-[158px] top-[84px] -rotate-[32deg]" />

      <NonnaVoice idle={idle} onChange={reorders.reload} />

      <div className="grid grid-cols-2 gap-6">
        {doors.map((d) => (
          <Link key={d.href} href={d.href} className="door relative">
            <IconDot name={d.icon} tint={d.tint} />
            <span className="flex flex-1 flex-col gap-1">
              <span className="font-display text-[36px] leading-[1.1]">{d.title}</span>
              <span className="text-[23px] font-semibold text-ink-soft">{d.note}</span>
            </span>
            {d.href === "/kiosk/orders" && waiting > 0 && (
              <span className="font-display pop-in flex h-[60px] min-w-[60px] items-center justify-center rounded-full bg-wine px-3.5 text-[32px] text-card">
                {waiting}
              </span>
            )}
            <Icon name="chevron" size={32} stroke={2} className="shrink-0 text-rust" />
          </Link>
        ))}
      </div>

      <Link href="/kiosk/menu/new" className="big-btn btn-primary min-h-[84px] self-center px-12 text-[34px]">
        <Icon name="plus" size={32} stroke={2.2} /> Add a new treat
      </Link>
    </main>
  );
}
