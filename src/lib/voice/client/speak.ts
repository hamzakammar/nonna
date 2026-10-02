"use client";
/**
 * LANE 2: Nonna's mouth. P0 uses the browser's speechSynthesis (pick an
 * Italian-accented English voice if there is one, rate ~0.95). P1 swaps in a
 * nicer TTS behind the same function, falling back to speechSynthesis on error.
 * Pause the ears while speaking, or Nonna will hear herself.
 */
export async function speak(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
