// Narration for the v2 demo film: one ElevenLabs file per scene, read from video/SCRIPT.md section 5.
// usage: pnpm exec tsx scripts/_vo2.ts [S03 S07 …]   → video/allowance-v2/assets/audio/vo/Sxx.mp3 + lines.json
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const KEY = process.env.ELEVENLABS_API_KEY!.trim();
const VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah, same narrator as v1
const ROOT = `${process.cwd()}/video`; // run from the repo root
const OUT = `${ROOT}/allowance-v2/assets/audio/vo`;
mkdirSync(OUT, { recursive: true });

const md = readFileSync(`${ROOT}/SCRIPT.md`, "utf8");
const sec = md.split("## 5. Full narration")[1].split("About 447 words")[0];
const LINES: Record<string, string> = {};
for (const block of sec.split(/\n\s*\n/)) {
  const m = block.trim().match(/^(S\d\d): ([\s\S]+)$/);
  if (m) LINES[m[1]] = m[2].replace(/\s+/g, " ").trim();
}

// Footage wins over the script where a number differs (the live agent's basket changes run to run):
// video/allowance-v2/src/overrides.json = { "S04": [["Twenty-four dollars", "Twenty-eight dollars"]] }
try {
  const ov = JSON.parse(readFileSync(`${ROOT}/allowance-v2/src/overrides.json`, "utf8")) as Record<string, [string, string][]>;
  for (const [id, pairs] of Object.entries(ov)) for (const [from, to] of pairs) {
    if (!LINES[id]?.includes(from)) throw new Error(`override for ${id}: "${from}" is not in the script line`);
    LINES[id] = LINES[id].replace(from, to);
  }
} catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }

async function main() {
  const only = process.argv.slice(2);
  const ids = Object.keys(LINES).filter((k) => !only.length || only.includes(k));
  for (const id of ids) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: LINES[id], model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, speed: 0.97 } }),
    });
    if (!r.ok) throw new Error(`${id}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(`${OUT}/${id}.mp3`, buf);
    console.log(`${id}: ${(buf.length / 1024).toFixed(0)} KB · ${LINES[id].split(" ").length} words`);
  }
  writeFileSync(`${OUT}/lines.json`, JSON.stringify(LINES, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
