"use client";
/**
 * LANE 2: the kiosk's ears. Browser-only hook.
 *
 * P0: Web Speech API (Chrome), continuous recognition. When a final result
 *     contains the wake word ("Nonna"), take the rest of the utterance (or the
 *     next one, if she paused) as the command and call onCommand(text).
 *     When `expectingAnswer` is true, skip the wake word. She just says "yes".
 * Fallback: the kiosk's big "Tap & talk" button calls `listenOnce()`.
 * Recognition stops by itself: restart it on `end` while `enabled`.
 */
export interface NonnaEars {
  supported: boolean;
  listening: boolean;
  lastHeard: string;
  listenOnce: () => void;
}

export function useNonnaEars(opts: {
  enabled: boolean;
  expectingAnswer: boolean;
  onCommand: (text: string) => void;
}): NonnaEars {
  void opts;
  // TODO(lane2)
  return { supported: false, listening: false, lastHeard: "", listenOnce: () => {} };
}
