// Generates every clip in lib/audio/manifest.ts with ElevenLabs and writes mp3s
// to public/audio. Skips files that already exist. Needs ELEVENLABS_API_KEY and
// optionally ELEVENLABS_VOICE_SCOUT / ELEVENLABS_VOICE_PENNY (voice ids).
//   pnpm audio:generate            # only missing clips
//   pnpm audio:generate --force    # regenerate everything
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { CLIPS } from "../lib/audio/manifest";

const KEY = process.env.ELEVENLABS_API_KEY?.trim();
const BASE = "https://api.elevenlabs.io/v1";
const OUT = "public/audio";
const force = process.argv.includes("--force");

async function pickVoices(): Promise<{ scout: string; penny: string }> {
  let scout = process.env.ELEVENLABS_VOICE_SCOUT?.trim();
  let penny = process.env.ELEVENLABS_VOICE_PENNY?.trim();
  if (scout && penny) return { scout, penny };
  const r = await fetch(`${BASE}/voices`, { headers: { "xi-api-key": KEY! } });
  const j = (await r.json()) as { voices: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> };
  const byName = (names: string[]) => j.voices.find((v) => names.some((n) => v.name.toLowerCase().includes(n)))?.voice_id;
  // sensible defaults from the standard library; override with env vars once you've picked
  scout = scout ?? byName(["jessica", "laura", "alice"]) ?? j.voices[0]?.voice_id;
  penny = penny ?? byName(["matilda", "sarah", "charlotte"]) ?? j.voices[1]?.voice_id;
  console.log("voices → scout:", scout, "penny:", penny, "(set ELEVENLABS_VOICE_SCOUT/PENNY to choose)");
  return { scout: scout!, penny: penny! };
}

async function tts(voice: string, text: string, kind: "scout" | "penny"): Promise<Buffer> {
  const r = await fetch(`${BASE}/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: kind === "scout" ? { stability: 0.35, similarity_boost: 0.8, style: 0.6, speed: 1.08 } : { stability: 0.6, similarity_boost: 0.8, style: 0.25, speed: 0.96 },
    }),
  });
  if (!r.ok) throw new Error(`tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function sfx(text: string, seconds: number): Promise<Buffer> {
  const r = await fetch(`${BASE}/sound-generation`, {
    method: "POST",
    headers: { "xi-api-key": KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.4 }),
  });
  if (!r.ok) throw new Error(`sfx ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  if (!KEY) { console.error("ELEVENLABS_API_KEY is not set."); process.exit(1); }
  mkdirSync(OUT, { recursive: true });
  const voices = await pickVoices();
  let made = 0;
  for (const c of CLIPS) {
    const file = `${OUT}/${c.id}.mp3`;
    if (existsSync(file) && !force) { console.log("skip ", c.id); continue; }
    process.stdout.write(`make  ${c.id} … `);
    const buf = c.kind === "sfx" ? await sfx(c.text, c.seconds ?? 1.5) : await tts(c.kind === "scout" ? voices.scout : voices.penny, c.text, c.kind);
    writeFileSync(file, buf);
    console.log(`${(buf.length / 1024).toFixed(0)} KB`);
    made++;
  }
  console.log(`done: ${made} generated, ${CLIPS.length - made} kept. Commit public/audio.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
