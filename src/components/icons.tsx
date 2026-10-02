// Line icons for the fall-classic look (paths from the Claude Design pass in design/). 24×24, stroked in currentColor.
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  home: (<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  chevron: <path d="M9 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  box: (<><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /><path d="M7.5 5.5l9 5" /></>),
  jar: (<><rect x="8" y="3" width="8" height="4" rx="1" /><rect x="6" y="7" width="12" height="14" rx="3.5" /><path d="M9 12.5h6" /><path d="M9 16h4" /></>),
  dome: (<><path d="M3.5 14a8.5 8.5 0 0 1 17 0z" /><path d="M2 14h20l-2 5.5H4z" /><path d="M9 10.5l1.5-2M12 10V7.5M15 10.5l-1.5-2" /></>),
  bars: (<><path d="M2.5 20h19" /><rect x="4.5" y="12" width="3.5" height="8" rx="0.8" /><rect x="10.25" y="5" width="3.5" height="15" rx="0.8" /><rect x="16" y="9" width="3.5" height="11" rx="0.8" /></>),
  hat: (<><path d="M7 14a4 4 0 1 1 1.5-7.7A4.5 4.5 0 0 1 16 5.5a4 4 0 1 1 1 8.5" /><path d="M7 14v6h10v-6" /><path d="M7 17h10" /></>),
  notebook: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18" /><path d="M12 8h4M12 12h4" /></>),
  bottle: (<><path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z" /><path d="M8 13h8" /></>),
  sack: (<><path d="M8 3h8l-1.5 3.5c3 2 4.5 5 4.5 8.5 0 4-2.5 6-7 6s-7-2-7-6c0-3.5 1.5-6.5 4.5-8.5z" /><path d="M9.5 6.5h5" /></>),
  egg: <path d="M12 3c3.5 0 6.5 5.5 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.5 8.5 3 12 3z" />,
  apple: (<><path d="M12 7c-2-2-7-1.5-7 4 0 4 3 9 5 9 1 0 1.3-.5 2-.5s1 .5 2 .5c2 0 5-5 5-9 0-5.5-5-6-7-4z" /><path d="M12 7c0-2 1-3.5 3-4" /></>),
  leaf: (<><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" /><path d="M4 20L15 9" /></>),
  cup: (<><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M8 3v3M12 3v3" /></>),
  truck: (<><path d="M2 6h11v10H2z" /><path d="M13 9h4l4 4v3h-8" /><circle cx="6" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></>),
  ear: (<><path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0" /><path d="M10 9a2 2 0 0 1 4 0" /></>),
  phone: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />,
  tag: (<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.5" /></>),
  store: (<><path d="M3 9l2-5h14l2 5" /><path d="M3 9h18a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M5 12v8h14v-8" /><path d="M10 20v-5h4v5" /></>),
  trash: (<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  card: (<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>),
  cash: (<><rect x="3" y="7" width="18" height="10" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 28, stroke = 1.8, className, label }: { name: IconName; size?: number; stroke?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PATHS[name]}
    </svg>
  );
}

/** A tinted circle with an icon in it, the way the designs mark every card. */
export const TINTS = {
  rust: { bg: "#f6dcc4", fg: "#a94f1d" },
  gold: { bg: "#f3e3b3", fg: "#7a5a12" },
  olive: { bg: "#dfe6cf", fg: "#4c5a2c" },
  rose: { bg: "#efd3cb", fg: "#8a3324" },
} as const;

export function IconDot({ name, tint, size = 104 }: { name: IconName; tint: keyof typeof TINTS; size?: number }) {
  const t = TINTS[tint];
  return (
    <span className="icon-dot" style={{ width: size, height: size, background: t.bg, color: t.fg }}>
      <Icon name={name} size={Math.round(size * 0.54)} stroke={1.6} />
    </span>
  );
}

/** Which icon (and tint) suits an ingredient, by name. */
export function ingredientIcon(name: string): { name: IconName; tint: keyof typeof TINTS } {
  const n = name.toLowerCase();
  if (/cream|milk|yog|mascarpone|cheese|ricotta|syrup/.test(n)) return { name: "bottle", tint: "rust" };
  if (/egg/.test(n)) return { name: "egg", tint: "gold" };
  if (/apple|berr|lemon|peach|cherr|pumpkin|banana|fruit/.test(n)) return { name: "apple", tint: "olive" };
  if (/coffee|espresso|bean|tea/.test(n)) return { name: "cup", tint: "rose" };
  if (/cup|box|bag/.test(n)) return { name: "box", tint: "gold" };
  if (/flour|sugar|granola|oat|cinnamon|spice|salt|cocoa/.test(n)) return { name: "sack", tint: "gold" };
  return { name: "jar", tint: "gold" };
}
