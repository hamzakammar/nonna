"use client";
// Small switcher between the four screens, tucked in the bottom-left corner so it never
// competes with Grandma's one big task. Sits under dialogs (z-40) and the confetti layer (z-50).
import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/kiosk", label: "Kiosk" },
  { href: "/pos", label: "Till" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/demo", label: "Demo" },
];

export function PageNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Screens"
      className="fixed bottom-4 left-4 z-30 flex gap-1 rounded-full border border-linen bg-card/95 p-1 text-[15px] font-bold shadow-sm"
    >
      {PAGES.map((p) => {
        const active = path === p.href || path.startsWith(`${p.href}/`);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              active ? "bg-tint-rust text-rust" : "text-ink-soft hover:bg-paper hover:text-ink"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
