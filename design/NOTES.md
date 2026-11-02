# Design handoff — Core demo (Claude Design, 2026-11-02)

Source project: Claude Design "Allowance Core Demo" (`Allowance Core Demo.dc.html` is a canvas that composes the two screens below plus the stage). Files here are the exact sources pulled from the project. `support.js` (the Claude Design runtime) is not needed.

| File | What |
|---|---|
| `allowance-desktop.dc.html` | Shell + **Shop with Scout** (states: default / empty / error) + **Needs your OK desktop** (page=waiting, states: default / empty). Preview 1440×900; checked at 1920×1080. |
| `needs-ok-mobile.dc.html` | **Needs your OK** on a phone, 390×844. States: default / approved / declined / error. |
| `stage.js` | The pixel stage: `Sprite`, `AgentCam` (scenes paid / hold / blocked / idle / paused / tour), `CoinRain`, `Halftone` (motifs dome / coin). Ported to `components/stage/*` in the app. |

## Tokens (as used in the designs)

paper `#F6F1E7` · card `#FFFDF8` · ink `#1C1B19` · muted `#6B665C` · line `#E6DFD1` · hover-line `#B8AE9C` · gold `#D9A21B` (hover `#C8930F`) · paid `#2F8F5B` (pill bg `#E3F1E8`, text `#1D6640`) · hold `#E5771E` (pill bg `#FCEADA`, text `#8A420A`, dark text `#6E3407`) · blocked `#D2483C` (pill bg `#F9E2DF`, text `#9E2F28`, soft bg `#FBEAE7`) · neutral pill bg `#EDE6D8`.

Type: Instrument Serif italic 400 for headlines (30 wordmark · 40 mobile h1 · 48/56 desktop h1) · Inter 16 body, 15 secondary, 14 meta · JetBrains Mono for amounts/IDs/times · Pixelify Sans ONLY inside the stage.

Shapes: pills 999px; cards 14–18px radius, 1px `line` border, shadow `0 1px 2px rgba(28,27,25,.04)`. Buttons 44–56px tall. Focus ring: `outline: 3px solid ink; offset 2px` (gold ring on the active nav pill).

## Shop with Scout

- Header 72px: wordmark · nav pills (active = ink fill, count badge on "Needs your OK" in hold-amber) · right: "$67.80 of $150 spent this week" + 220×8 gold progress bar · **Plain view** switch (shop page only) · **Sound off/on** toggle.
- Columns: `minmax(300px,360px) | 1fr | minmax(320px,400px)`; Plain view → `1fr 1fr`, cam hidden.
- Chat: "you" bubbles (ink, right), step cards (paper bg, dot, plain sentence), Scout bubbles (card, left, label "Scout"), error card (soft red). Empty: Scout greeting + "Try this" suggestion button. Composer: textarea on paper + gold Send.
- Agent Cam: titled "Agent Cam" / "Watch Scout shop. Penny pays only when your rules say yes." + caption "Penny's belly shows what's left this week: $82.20". Cam scene = idle (napping) when empty, paused ("WAITING FOR PAYPAL") on error.
- Feed "What happened": cards with pill (Paid / Needs your OK / Blocked / Not bought), time, item, store, amount, one-sentence reason, (hold) countdown + Approve / Don't buy, "Details" toggle → mono block with PayPal reference. Empty: Halftone dome + "nothing yet. ask Scout to buy something and it'll show up here."
- Error state: banner above main — "We can't reach PayPal right now." / "Scout has paused, and nothing new was charged. Reconnect PayPal to keep going." + gold "Reconnect PayPal".

## The three outcomes (motion intent)

- **Paid:** three coins arc from Penny into the shop, 220 ms apart, ease-out; her belly drops as they leave. Receipt prints down over 1.2 s (store, N ITEMS, TOTAL, PAID ✓). Card slides into the feed (200 ms ease-out, 8 px rise).
- **Needs your OK:** jar pops in above Penny (180 ms, small overshoot) and bobs slowly; Scout taps a foot holding the item up. Countdown ticks once a second; no flashing, no colour change near zero.
- **Blocked:** x-ray band sweeps down the storefront in 1.4 s; hidden lines appear in red as it passes. Penny steps in, door slams with a 2 px shake, BLOCKED stamp lands in 250 ms with slight overshoot, Scout turns away.

## Needs your OK

- Desktop: h1 "1 thing needs your OK" + "PayPal is holding the money. Nothing is charged until you approve, and if you don't decide in time, the hold is released." Card grid `168px | 1fr | 220px`: photo · pill, item + store, amount + "usually about $95", reason, countdown · stacked Approve / Don't buy. Empty: Halftone coin, "Nothing needs your OK", explainer, gold "Shop with Scout →".
- Mobile: status bar · wordmark + "$67.80 of $150 this week" · h1 "Scout needs your OK" · 132px mini stage (Scout plead + "pretty please?" · jar over Penny at 55%) · card (photo, item/store, amount + usual, reason, amber countdown chip) · Approve (56px gold) / Don't buy (outline) · "Details" → mono reference block.
- After Approve: 220px stage with Scout-with-bag, Penny at 20%, coin rain · h1 "Paid ✓" · Paid card "You approved it, so PayPal paid VoltHub. You'll find it in Activity." · "Back to Scout".
- After Don't buy: Scout shrug + "oh well!" bubble · h1 "Hold released, you weren't charged" · Not bought card "PayPal let go of the $129 it was holding. Scout won't buy these headphones."
- Error: red alert in card — "That didn't go through. PayPal didn't answer, so you weren't charged. The hold is still there, with 8:15 left to decide." Primary becomes "Try again".

## Next round (not designed yet)

Welcome / Link PayPal, Your rules, Activity, Settings, the three storefronts, style guide, character sheet.
