// What Nonna says on a screen. In the fall-classic look she speaks as a warm subtitle under the
// page title, not a cartoon bubble. NonnaFace stays for anyone who still wants the drawing.
import type { ReactNode } from "react";

export function NonnaFace({ size = 140, mood = "happy", className = "" }: { size?: number; mood?: "happy" | "proud" | "worried"; className?: string }) {
  const mouth =
    mood === "worried" ? "M78 132 Q100 122 122 132" : mood === "proud" ? "M74 124 Q100 152 126 124 Z" : "M78 126 Q100 144 122 126";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Nonna" className={className}>
      <circle cx="100" cy="34" r="24" fill="#f4f1ec" stroke="#3b2416" strokeWidth="5" />
      <ellipse cx="100" cy="98" rx="74" ry="72" fill="#f4f1ec" stroke="#3b2416" strokeWidth="5" />
      <ellipse cx="100" cy="110" rx="58" ry="58" fill="#f6dcc4" stroke="#3b2416" strokeWidth="5" />
      <path d="M44 96 Q60 58 100 60 Q140 58 156 96 Q132 78 100 82 Q68 78 44 96 Z" fill="#f4f1ec" stroke="#3b2416" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="78" cy="104" r="16" fill="white" fillOpacity="0.5" stroke="#3b2416" strokeWidth="5" />
      <circle cx="122" cy="104" r="16" fill="white" fillOpacity="0.5" stroke="#3b2416" strokeWidth="5" />
      <path d="M94 104 L106 104" stroke="#3b2416" strokeWidth="5" strokeLinecap="round" />
      <circle cx="78" cy="105" r="5" fill="#3b2416" />
      <circle cx="122" cy="105" r="5" fill="#3b2416" />
      <path d={mouth} fill={mood === "proud" ? "#a94f1d" : "none"} stroke="#3b2416" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Nonna's line for this screen. Keep `children` to one or two short sentences. */
export function NonnaSays({ children }: { children: ReactNode; mood?: "happy" | "proud" | "worried"; size?: number }) {
  return <p className="m-0 text-[28px] font-bold leading-snug text-ink-soft [text-wrap:pretty]">{children}</p>;
}
