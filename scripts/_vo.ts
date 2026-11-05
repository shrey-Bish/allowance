// Narration for the demo video (spec §21.2), one ElevenLabs clip per line → video/vo/NN.mp3
import "dotenv/config";
import { writeFileSync } from "node:fs";
const KEY = process.env.ELEVENLABS_API_KEY!.trim();
const VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah — calm, soft narrator
const OUT = "/Users/shrey/Downloads/paypalai/video/vo";
const LINES = [
  "AI agents can shop for you now. But would you hand one your PayPal?",
  "This is Allowance. Give your agent an allowance, not your wallet.",
  "You link PayPal once.",
  "Then set the rules: a weekly budget, and the amount where it has to ask you first.",
  "Small stuff just goes through. Groceries, a charger: within your rules, so PayPal pays.",
  "Anything over your limit, PayPal holds the money until you say yes.",
  "On your phone, if you like. Tap approve, and PayPal pays.",
  "This store hid instructions for the AI on its page. Allowance caught it, and nothing was charged.",
  "Say no, and the hold is released.",
  "Hit your budget, and the agent stops.",
  "Every decision, every PayPal payment, in one log.",
  "And the same payments, right there in PayPal.",
  "Allowance. For anyone who wants AI to buy for them, without handing over the keys.",
];
async function main() {
  for (let i = 0; i < LINES.length; i++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: LINES[i], model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.15, speed: 0.97 } }),
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 120)}`);
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(`${OUT}/${String(i + 1).padStart(2, "0")}.mp3`, buf);
    console.log(`vo ${i + 1}: ${(buf.length / 1024).toFixed(0)} KB — ${LINES[i]}`);
  }
  writeFileSync(`${OUT}/lines.json`, JSON.stringify(LINES, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
