"use client";
// Plays the pre-generated clips when sound is on. Missing files fail silently
// (the app ships before the audio is generated).
import { useCallback, useRef } from "react";
import { usePrefs } from "./prefs";
import { clipUrl } from "@/lib/audio/manifest";

export function useSound() {
  const { sound } = usePrefs();
  const cache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const play = useCallback((id: string, volume = 0.8) => {
    if (!sound || typeof window === "undefined") return;
    try {
      let a = cache.current.get(id);
      if (!a) { a = new Audio(clipUrl(id)); a.preload = "auto"; cache.current.set(id, a); }
      a.volume = volume;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  }, [sound]);
  /** play several ids in order with small gaps (e.g. sfx then a voice line) */
  const sequence = useCallback((ids: string[], gapMs = 350) => {
    ids.forEach((id, i) => setTimeout(() => play(id), i * gapMs));
  }, [play]);
  return { play, sequence, enabled: sound };
}
