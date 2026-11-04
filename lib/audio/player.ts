"use client";
// Web Audio player. Browsers only allow sound after a user gesture; `unlock()`
// must be called inside the click that turns sound on, and from then on clips
// can start from network events (SSE decisions, approvals). Falls back to
// <audio> where Web Audio is missing.
import { clipUrl } from "./manifest";

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let gain: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let unlocked = false;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0.9;
    gain.connect(ctx.destination);
  }
  return ctx;
}

/** Call synchronously inside a user gesture (the sound toggle click). */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  // play one silent sample so iOS/Safari mark the context as user-activated
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch {}
  unlocked = true;
}

export function isUnlocked(): boolean {
  return unlocked && getCtx()?.state === "running";
}

async function load(id: string): Promise<AudioBuffer | null> {
  const c = getCtx();
  if (!c) return null;
  let p = buffers.get(id);
  if (!p) {
    p = fetch(clipUrl(id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => c.decodeAudioData(ab))
      .catch(() => null);
    buffers.set(id, p);
  }
  return p;
}

export function preload(ids: string[]): void {
  ids.forEach((id) => void load(id));
}

export async function playClip(id: string, volume = 1): Promise<void> {
  const c = getCtx();
  if (!c || !gain) return playFallback(id, volume);
  if (c.state === "suspended") await c.resume().catch(() => {});
  const buf = await load(id);
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  if (volume !== 1) {
    const g = c.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(gain);
  } else {
    src.connect(gain);
  }
  src.start(0);
}

function playFallback(id: string, volume: number) {
  try {
    const a = new Audio(clipUrl(id));
    a.volume = volume;
    a.play().catch(() => {});
  } catch {}
}
