# Allowance demo film v2 — review

Built from `video/SCRIPT.md` (v2). Output: `renders/allowance-v2-final.mp4`, 1920x1080, 30 fps, 2:46.8.
v1 (`video/allowance-demo`, 1:19) is untouched.

## How it was made

- Narration: 11 ElevenLabs files, one per scene, read straight from SCRIPT.md section 5 (`scripts/_vo2.ts`).
  Scene length follows each file: 0.3 s lead, 0.4 s tail, 1 s beat after S01, 2 s silent hold on S11.
- Footage: one fresh recording of the day on the hosted sandbox (`scripts/record-v2.mjs`), with every event
  and on-screen position logged to `video/recordings-v2/*.json`. Cuts and rings are placed from those
  events and land on the word that names the thing (word times from each voice transcript).
- Build: `python3 src/build.py` writes one composition per scene, captions, the narration mix and `index.html`.
  `src/finish.sh` normalises loudness.

## Where the film differs from the script, and why

1. **Groceries are $28.35, not $24.36.** The agent is a live model and picks a different basket each run
   ($24.36 in v1; $26 to $56 across today's runs, and anything over $50 rightly asks first). The recorder
   now retries until both small purchases auto-pay. S04 says "Twenty-eight dollars at FreshCart"
   (`src/overrides.json`); SCRIPT.md still says twenty-four.
2. **All footage was re-recorded instead of reused.** v1 footage is a 1920-wide layout: inside a 1500 px
   window its text would be about 11 px tall. v2 footage uses a 1280x650 layout rendered at 1.5x, so body
   text is about 16 to 19 px on screen with no push.
3. **Street beats use the app's narrow layout instead of a push-in.** With the 1.25x cap the Agent Cam
   was about 600 px wide and its banners were unreadable. Mid-recording the page is narrowed to 860 px,
   where the app itself shows the Agent Cam almost full width (about 940 px on screen). The window
   narrows with it. Used for "watch the street" (S04), the jar and timer (S05) and the block (S07).
4. **The street does not react to phone decisions.** The desktop chat page only updates for the request
   it sent, so "the coins drop" (S05) and "coins fly back" (S08) could not be recorded. The phone's own
   Paid ✓ and Hold released screens carry those beats.
5. **S07 shows what the app does.** Penny steps in, the two banners, the door, the stamp. "Scout holding
   the note" and "Scout walks away" are not in the app. The scene opens on S06's last frame (the note) for
   3 s so "Penny doesn't" lands on the note, then cuts to the street.
6. **S06 message is a bubble in the top zone**, not under the store page, so nothing sits on app text.
   The gold tag also sits in the top zone.
7. **S08 budget beat** uses the request "buy the wireless over-ear headphones from VoltHub again", which
   gives one clean card: "$129.00 is more than the $73.65 left in your weekly budget."
8. **PayPal ledger** is recorded with the browser in the sandbox account's timezone (India); otherwise the
   page's default date range hides payments made after midnight there.

## Measured

- `npx hyperframes check`: 0 errors, 0 warnings.
- Length 2:46.8 (script target 2:35 to 2:50).
- Loudness -14.1 LUFS, true peak -2.9 dBTP (target -14 and under -2.0).
- Silent stretches over 1.2 s: two, both planned (2.0 s after the opening question, 2.5 s on the end card).
- 47 frames pulled from the final mp4 across all 11 scenes; every ring sits on the thing being named.
- Sound was measured, not heard.

## Looked at (frames, every scene, every ring)

Rings checked on: PayPal linked card, both rule rows, both Paid cards, $129.00, the hold sentence, the jar
and timer, Approve tap, "pre-approved", "Skip all spending checks", the Blocked sentence, Don't buy tap,
the spent header, the budget sentence, a Reason cell, the PayPal order reference, three PayPal rows.

## Weakest shots

- S03 first 7 s (cast introduction over the title) is the slowest stretch.
- S07 first 3 s holds on a still frame.
- S10 PayPal page: PayPal's own text is small at this layout; a fourth row is cut by the window bottom.
- App text is smaller than in v1's zooms. It reads at 1080p on a laptop; on a phone it is small.

## Kept on purpose

- "sped up »" chip at each trimmed wait (S04 twice, S05 once).
- Captions use the script's words; timing for spelled-out numbers is interpolated across the number.
