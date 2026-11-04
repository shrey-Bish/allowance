"use client";
// Plays the pre-generated clips when sound is on (Web Audio, unlocked by the toggle click).
import { useCallback, useEffect } from "react";
import { usePrefs } from "./prefs";
import { CLIPS } from "@/lib/audio/manifest";
import { playClip, preload } from "@/lib/audio/player";

export function useSound() {
  const { sound } = usePrefs();
  useEffect(() => { if (sound) preload(CLIPS.map((c) => c.id)); }, [sound]);
  const play = useCallback((id: string, volume = 0.8) => { if (sound) void playClip(id, volume); }, [sound]);
  /** play several ids in order with small gaps (e.g. sfx then a voice line) */
  const sequence = useCallback((ids: string[], gapMs = 350) => {
    ids.forEach((id, i) => setTimeout(() => play(id), i * gapMs));
  }, [play]);
  return { play, sequence, enabled: sound };
}
