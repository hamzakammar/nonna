"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

export interface NonnaEars {
  supported: boolean;
  listening: boolean;
  lastHeard: string;
  listenOnce: () => void;
}

export function useNonnaEars(opts: { enabled: boolean; expectingAnswer: boolean; onCommand: (text: string) => void }): NonnaEars {
  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const optsRef = useRef(opts);
  const waitingForCommand = useRef(false);
  const once = useRef(false);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  const start = useCallback(() => {
    if (!recognition.current || (!optsRef.current.enabled && !once.current)) return;
    try { recognition.current.start(); setListening(true); } catch { /* already running */ }
  }, []);

  useEffect(() => {
    const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) return;
    const ear = new Constructor();
    recognition.current = ear;
    ear.continuous = true;
    ear.interimResults = false;
    ear.lang = "en-US";
    ear.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const transcript = result[0].transcript.trim();
        setLastHeard(transcript);
        console.log("[Nonna ears]", transcript);
        if (optsRef.current.expectingAnswer || waitingForCommand.current || once.current) {
          waitingForCommand.current = false;
          once.current = false;
          if (transcript) optsRef.current.onCommand(transcript);
          continue;
        }
        const wake = /\b(?:nonna|nona|nana|nonnah)\b[\s,!.?]*/i.exec(transcript);
        if (!wake) continue;
        const command = transcript.slice(wake.index + wake[0].length).trim();
        if (command) optsRef.current.onCommand(command);
        else waitingForCommand.current = true;
      }
    };
    ear.onend = () => {
      setListening(false);
      if (optsRef.current.enabled) window.setTimeout(start, 200);
    };
    ear.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") setListening(false);
    };
    if (optsRef.current.enabled) window.setTimeout(start, 0);
    return () => {
      ear.onend = null;
      ear.abort();
      recognition.current = null;
    };
  }, [start]);

  useEffect(() => {
    if (opts.enabled) window.setTimeout(start, 0);
    else recognition.current?.abort();
  }, [opts.enabled, start]);

  const listenOnce = useCallback(() => { once.current = true; start(); }, [start]);
  return { supported, listening, lastHeard, listenOnce };
}
