"use client";
// Per-viewer UI preferences (Plain view, sound). Persisted in localStorage.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { playClip, unlockAudio } from "@/lib/audio/player";

interface Prefs { plain: boolean; sound: boolean; record: boolean }
interface Ctx extends Prefs { setPlain: (v: boolean) => void; setSound: (v: boolean) => void }
const PrefsCtx = createContext<Ctx>({ plain: false, sound: false, record: false, setPlain: () => {}, setSound: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [plain, setPlainState] = useState(false);
  const [sound, setSoundState] = useState(false);
  const [record, setRecord] = useState(false);
  useEffect(() => {
    // read stored prefs after mount (SSR renders the defaults)
    const id = setTimeout(() => {
      try {
        setPlainState(localStorage.getItem("allowance:plain") === "1");
        setSoundState(localStorage.getItem("allowance:sound") === "1");
      } catch {}
      setRecord(new URLSearchParams(window.location.search).get("record") === "1");
    }, 0);
    return () => clearTimeout(id);
  }, []);
  const setPlain = (v: boolean) => { setPlainState(v); try { localStorage.setItem("allowance:plain", v ? "1" : "0"); } catch {} };
  const setSound = (v: boolean) => {
    setSoundState(v);
    try { localStorage.setItem("allowance:sound", v ? "1" : "0"); } catch {}
    if (v) {
      // must happen inside the click: unlocks audio for everything that follows,
      // and the coin confirms to the person that sound really is on
      unlockAudio();
      void playClip("sfx-coin", 0.8);
    }
  };
  return <PrefsCtx.Provider value={{ plain, sound, record, setPlain, setSound }}>{children}</PrefsCtx.Provider>;
}
export const usePrefs = () => useContext(PrefsCtx);
