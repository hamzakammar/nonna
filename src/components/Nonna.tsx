// Nonna's cartoon face + speech bubble. Pure SVG, no assets.
import type { ReactNode } from "react";

export function NonnaFace({ size = 140, mood = "happy", className = "" }: { size?: number; mood?: "happy" | "proud" | "worried"; className?: string }) {
  const mouth =
    mood === "worried" ? "M78 132 Q100 122 122 132" : mood === "proud" ? "M74 124 Q100 152 126 124 Z" : "M78 126 Q100 144 122 126";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Nonna" className={className}>
      {/* hair bun + hair */}
      <circle cx="100" cy="34" r="24" fill="#f4f1ec" stroke="#4a2c17" strokeWidth="5" />
      <ellipse cx="100" cy="98" rx="74" ry="72" fill="#f4f1ec" stroke="#4a2c17" strokeWidth="5" />
      {/* face */}
      <ellipse cx="100" cy="110" rx="58" ry="58" fill="#ffd9b8" stroke="#4a2c17" strokeWidth="5" />
      {/* fringe */}
      <path d="M44 96 Q60 58 100 60 Q140 58 156 96 Q132 78 100 82 Q68 78 44 96 Z" fill="#f4f1ec" stroke="#4a2c17" strokeWidth="5" strokeLinejoin="round" />
      {/* cheeks */}
      <circle cx="66" cy="122" r="11" fill="#ff9e9e" opacity="0.75" />
      <circle cx="134" cy="122" r="11" fill="#ff9e9e" opacity="0.75" />
      {/* glasses */}
      <circle cx="78" cy="104" r="16" fill="white" fillOpacity="0.5" stroke="#4a2c17" strokeWidth="5" />
      <circle cx="122" cy="104" r="16" fill="white" fillOpacity="0.5" stroke="#4a2c17" strokeWidth="5" />
      <path d="M94 104 L106 104" stroke="#4a2c17" strokeWidth="5" strokeLinecap="round" />
      {/* eyes */}
      {mood === "proud" ? (
        <>
          <path d="M70 106 Q78 98 86 106" fill="none" stroke="#4a2c17" strokeWidth="5" strokeLinecap="round" />
          <path d="M114 106 Q122 98 130 106" fill="none" stroke="#4a2c17" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="78" cy="105" r="5" fill="#4a2c17" />
          <circle cx="122" cy="105" r="5" fill="#4a2c17" />
        </>
      )}
      {/* mouth */}
      <path d={mouth} fill={mood === "proud" ? "#c4573b" : "none"} stroke="#4a2c17" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* earrings */}
      <circle cx="40" cy="128" r="6" fill="#e07a5f" stroke="#4a2c17" strokeWidth="3" />
      <circle cx="160" cy="128" r="6" fill="#e07a5f" stroke="#4a2c17" strokeWidth="3" />
    </svg>
  );
}

/** Nonna saying something. Keep `children` to one or two short sentences. */
export function NonnaSays({ children, mood, size = 120 }: { children: ReactNode; mood?: "happy" | "proud" | "worried"; size?: number }) {
  return (
    <div className="flex items-center gap-4">
      <NonnaFace size={size} mood={mood} className="shrink-0 bob" />
      <div className="toon relative px-6 py-4 text-[26px] font-bold leading-snug">
        <span
          aria-hidden
          className="absolute -left-[18px] top-1/2 h-0 w-0 -translate-y-1/2 border-y-[14px] border-r-[18px] border-y-transparent border-r-cocoa"
        />
        {children}
      </div>
    </div>
  );
}
