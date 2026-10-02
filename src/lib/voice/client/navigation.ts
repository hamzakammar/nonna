/** Only these fixed destinations may be reached by a spoken command. */
export type VoiceNavigation =
  | { type: "route"; href: "/" | "/kiosk" | "/dashboard" | "/pos" | "/demo"; label: string }
  | { type: "back" | "forward" | "top" | "bottom" | "scroll_up" | "scroll_down" };

const destinations: { href: VoiceNavigation & { type: "route" }; aliases: RegExp }[] = [
  { href: { type: "route", href: "/", label: "Home" }, aliases: /^(?:home|home page|start page|main page)$/ },
  { href: { type: "route", href: "/kiosk", label: "Kiosk" }, aliases: /^(?:kiosk|grandma|voice|listening page)$/ },
  { href: { type: "route", href: "/dashboard", label: "Dashboard" }, aliases: /^(?:dashboard|back office|inventory|reorders?|analytics|sales dashboard|performance)$/ },
  { href: { type: "route", href: "/pos", label: "Till" }, aliases: /^(?:till|register|checkout|point of sale|pos)$/ },
  { href: { type: "route", href: "/demo", label: "Demo" }, aliases: /^(?:demo|demo controls?|control panel|simulator)$/ },
];

export function parseVoiceNavigation(transcript: string): VoiceNavigation | null {
  const words = transcript.toLowerCase().replace(/^\s*(?:nonna|nona|nana|nonnah)\b[,.!\s]*/i, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(?:go back|back|previous page)$/.test(words)) return { type: "back" };
  if (/^(?:go forward|forward|next page)$/.test(words)) return { type: "forward" };
  if (/^(?:scroll to )?(?:the )?top(?: of (?:the )?page)?$/.test(words)) return { type: "top" };
  if (/^(?:scroll to )?(?:the )?bottom(?: of (?:the )?page)?$/.test(words)) return { type: "bottom" };
  if (/^(?:scroll|move) up$/.test(words)) return { type: "scroll_up" };
  if (/^(?:scroll|move) down$/.test(words)) return { type: "scroll_down" };

  const target = words.replace(/^(?:(?:please )?(?:go to|open|show(?: me)?|take me to|switch to|navigate to|visit)\s+)/, "")
    .replace(/^(?:the|my)\s+/, "").replace(/\s+page$/, "");
  if (target === words && !/^(?:home|kiosk|dashboard|till|demo)$/.test(words)) return null;
  return destinations.find(({ aliases }) => aliases.test(target))?.href ?? null;
}
