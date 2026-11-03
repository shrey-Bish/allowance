// Every sound in the app (spec §12A Audio). Clips are generated once with
// ElevenLabs by `pnpm audio:generate` and committed to /public/audio so judges
// never need a key. Ids are what the UI plays; files are mp3.
export type ClipKind = "scout" | "penny" | "sfx";

export interface Clip {
  id: string;
  kind: ClipKind;
  /** spoken line (voices) or sound description (sfx) */
  text: string;
  /** sfx only: target length in seconds */
  seconds?: number;
}

export const CLIPS: Clip[] = [
  // Scout — small, eager
  { id: "scout-hi", kind: "scout", text: "hi! tell me what to buy, and I'll stick to your rules." },
  { id: "scout-on-it", kind: "scout", text: "on it!" },
  { id: "scout-please", kind: "scout", text: "pretty please?" },
  { id: "scout-oh-well", kind: "scout", text: "oh well!" },
  { id: "scout-not-looking", kind: "scout", text: "not looking!" },
  // Penny — calm, a bit stern, protective
  { id: "penny-paying", kind: "penny", text: "all good. paying now." },
  { id: "penny-hold", kind: "penny", text: "that's over your limit. holding it until you say so." },
  { id: "penny-block", kind: "penny", text: "nope. that store's sketchy." },
  { id: "penny-xray", kind: "penny", text: "hidden instructions on this page. not falling for it." },
  { id: "penny-released", kind: "penny", text: "hold released. you weren't charged." },
  { id: "penny-budget", kind: "penny", text: "that's the whole allowance for this week." },
  // Sound effects
  { id: "sfx-coin", kind: "sfx", text: "a single gold coin dropping into a ceramic piggy bank, short, bright, 8-bit video game style", seconds: 1 },
  { id: "sfx-coin-rain", kind: "sfx", text: "a shower of many small coins tumbling and clinking, playful 8-bit video game style", seconds: 2.5 },
  { id: "sfx-jar", kind: "sfx", text: "a glass jar being set down with a soft clink, then coins settling inside it", seconds: 1.5 },
  { id: "sfx-door-slam", kind: "sfx", text: "a small wooden shop door slamming shut, retro video game style", seconds: 1 },
  { id: "sfx-stamp", kind: "sfx", text: "a heavy rubber stamp slamming onto paper, a loud thud, retro video game style", seconds: 1 },
  { id: "sfx-receipt", kind: "sfx", text: "a tiny thermal receipt printer printing and tearing, retro video game style", seconds: 1.5 },
  { id: "sfx-footsteps", kind: "sfx", text: "quick light footsteps of a small animal on pavement, 8-bit video game style", seconds: 1.5 },
  { id: "sfx-glitch", kind: "sfx", text: "a short digital glitch x-ray scan sweep, electronic, retro video game style", seconds: 1.5 },
];

export const clipUrl = (id: string) => `/audio/${id}.mp3`;
