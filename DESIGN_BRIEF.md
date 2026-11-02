# Design brief — Allowance (PayPal AI Hackathon)
Paste this into Claude Design. It's self-contained.

---

## 1. The product in one breath

**Allowance** lets you hand shopping to an AI agent without handing over your wallet. You link PayPal once and set simple rules. Your AI agent ("Scout") can then buy things for you. Small purchases go through; bigger ones wait for your OK while PayPal holds the money; sketchy ones get blocked. Every purchase shows up in one clear log.

**Tagline:** give your AI agent an allowance, not your wallet.

**Who uses it:** everyday people and small-business owners who want AI to buy things for them but don't trust it with money yet. Assume they are **not technical**.

**Feeling to create:** safe, calm, in control, and a little delightful.

---

## 2. Design principles (non-negotiable)

1. **Friendly, clean, self-explanatory.** Every screen answers "what is this?" and "what do I do next?" at a glance.
2. **One main action per screen**, visually obvious.
3. **Plain words only.** If a word would need explaining, replace it. Technical details (like PayPal reference IDs) live in a collapsed "Details" area.
4. **Explain as you go:**
   - short helper text under every setting
   - reasons written as full plain sentences
   - empty states that say what will appear there and what to do
   - errors that say what happened and what to do next
5. **Clean:**
   - lots of white space and generous spacing
   - one accent colour, plus three status colours used only for status
   - body text 16px or larger, strong contrast
   - every icon has a text label
6. **Tone:** warm, short, lowercase-friendly. Calm and clear in serious moments (money, blocks), never cutesy there.

### Words to use

| Don't say | Say |
|---|---|
| authorization / authorize | money on hold |
| capture | paid |
| void | hold released, you weren't charged |
| vault / payment token | PayPal linked |
| policy | your rules |
| risk score / AI verdict | safety check: looks fine · needs your OK · blocked |
| prompt injection | hidden instructions for the AI on this page |
| tool call | what Scout did ("Scout searched FreshCart for groceries") |
| merchant | store |
| API, webhook, token, sandbox ID | never shown in the main UI |

---

## 3. The look: editorial shell + pixel stage

The app has **two layers that must feel like one design**:
- **The shell** (every screen): calm, premium and editorial, like a well-designed magazine or a modern bank. This earns trust.
- **The stage** (only in specific spots): a small pixel-art world with two characters. This is the charm and the thing people remember.

### Shell

| Token | Suggested value | Use |
|---|---|---|
| paper (background) | #F6F1E7 | page background |
| card | #FFFDF8 | cards, panels |
| ink | #1C1B19 | main text |
| muted | #6B665C | secondary text |
| line | #E6DFD1 | 1px borders, dividers |
| coin gold (the one accent) | #D9A21B | primary buttons, highlights. As a fill only, with ink text on top (gold text on cream is too faint) |
| paid green | #2F8F5B | status only |
| needs-your-OK amber | #E5771E | status only |
| blocked red | #D2483C | status only |

Adjust the values if needed, but keep the roles: one accent, status colours only for status, and AA contrast.

- **Type:**
  - **Display:** a refined serif in italic for big headlines (e.g. *Instrument Serif* or *Fraunces*).
  - **UI and body:** *Inter*.
  - **Amounts and IDs:** a mono font (e.g. *JetBrains Mono*).
- **Shapes:** pill-shaped buttons and chips, cards with soft 1px borders, very light short shadows, rounded corners (12–16px on cards).
- **Illustration motif:** original **halftone / engraving-style** illustrations in ink on cream, for the hero and empty states. Ideas:
  - a piggy bank under a glass dome
  - a hand holding a single coin
  - a small fox with a shopping bag
- **Motion (for notes):** calm, 150–250 ms ease-out, small overshoot on pops, no bouncing UI.

### Stage (pixel world)

- **Where it appears:**
  - the **Agent Cam** (a framed window like a little live TV, showing a pixel street with three shops)
  - the receipt that prints out
  - the coin jar for held money
  - the BLOCKED stamp
  - small achievement badges
- **Pixel font** (e.g. *Pixelify Sans*) **only** inside the stage.
- **Limited palette:** about 12 colours, harmonised with the shell (cream, ink, gold, plus status colours).

### Characters (original, please design both)

- **Scout:** the shopping agent. A small pixel fox with a backpack, curious and eager.
  - Poses: idle, walking, carrying a shopping bag, waiting (tapping foot), guilty / turned away (blocked), covering its eyes, pleading (holding up an item), sleeping.
- **Penny:** the guard. A pixel piggy bank with a tiny badge, calm and protective, and she holds the coins.
  - Poses: idle, dropping coins (paid), holding a glass jar of coins (on hold), slamming a door (blocked), padlocked (budget used up).
  - **Her belly is the budget meter:** it visibly empties as money is spent.

### The three outcomes (key moments to design)

| Outcome | What happens on the stage | What the shell shows |
|---|---|---|
| **Paid** | Penny drops coins into the shop, Scout walks out with a bag, and a receipt prints out | Green "paid" card: item, store, amount, "Details" collapsed |
| **Needs your OK** | Coins float in a glass jar above Penny, with a countdown | Amber card: "That's over your $50 limit. PayPal is holding $129 until you decide." Big **Approve** / **Don't buy** buttons |
| **Blocked** | The scam store's page is "x-rayed" and hidden text appears in red. Penny slams the door, and a BLOCKED stamp lands | Red card: "This store hid instructions for the AI on its page, so we blocked it. You weren't charged." |

---

## 4. Screens to design

**Sizes:**
- desktop at 1440×900; check that the Agent Chat screen also works at 1920×1080 (the video is recorded there)
- mobile at 390×844 for the screens marked 📱

**For each screen, design:** the default state, the empty state (where relevant), and one error state.

### 4.1 Welcome / Link PayPal
- **Content:**
  - halftone hero illustration
  - headline: "give your AI an allowance, not your wallet"
  - one sentence explaining how it works
  - the PayPal button (represent the official PayPal button component; don't redraw the PayPal logo)
- **While PayPal is open:** a small Scout covers its eyes, with the caption "not looking!"
- **Success state:** "PayPal linked ✓" and a "Set your rules →" button.

### 4.2 Your rules
- **Settings**, each with helper text underneath:
  - weekly budget slider ("Scout can spend up to this much each week")
  - "ask me before anything over" amount
  - largest single purchase
  - "ask me the first time Scout uses a new store" toggle
  - "never buy gift cards" toggle
  - "how long to wait for my OK" (e.g. 10 minutes)
- **Live summary in plain English** (in a speech bubble from Scout): "Scout can spend up to $150 a week. Anything over $50, or at a new store, needs your OK. Gift cards are never allowed."
- **Primary action:** "Save rules".

### 4.3 Shop with Scout (the main screen)
Three columns:
- **Left, chat:**
  - you type a task (e.g. "buy groceries for the week under $60, and a phone charger")
  - Scout's steps appear as small plain-sentence cards ("Scout searched FreshCart for groceries", "Scout picked 9 items, $47.80")
- **Centre, Agent Cam:** the framed pixel street with three shops (FreshCart, VoltHub, MegaDealz247), Scout walking between them, and Penny at the door.
- **Right, what happened:** a live feed of outcome cards (paid / needs your OK / blocked), each with a one-sentence reason.

**Top bar:**
- **Budget:** "$67.80 of $150 spent this week", mirroring Penny's belly.
- **Toggles:** a "Plain view" toggle that hides the Agent Cam and widens the other columns, and a sound toggle (muted by default).

### 4.4 Needs your OK 📱 (most important mobile screen)
- **Card content:**
  - item photo, name and store
  - price, with the usual price for comparison ("usually about $95")
  - why it's waiting, as a plain sentence
  - countdown ("decide within 9:42, or the hold is released")
- **Actions:** big **Approve** and **Don't buy** buttons.
- **Small touch:** Scout holds up the item with pleading eyes.
- **Approve result:** coin rain, then "Paid ✓".
- **Don't buy result:** Scout shrugs, then "Hold released, you weren't charged".
- **Also design:** the desktop version (a list of waiting items).

### 4.5 Activity
- **Clean data table** with columns: time · store · items · amount · result (coloured badge) · safety check · reason.
- **Top:** a summary ("$67.80 of $150 spent this week · 4 paid · 1 waiting · 1 blocked"), a search box, filters, and "Download CSV".
- **Row click:** opens a side drawer with the full story of that purchase, in plain steps:
  - what Scout asked for
  - which rules applied
  - what the safety check found
  - what PayPal did
  - "Details" collapsed, holding the PayPal reference IDs
- **Empty state:** "nothing yet. ask Scout to buy something and it'll show up here."

### 4.6 Settings
- "Reset the demo" (with a short confirmation)
- sound on/off
- the linked PayPal account
- an "about this demo: test money only" note

### 4.7 The three demo stores (simple storefront pages, all fictional)
- **FreshCart (groceries):** friendly, fair prices.
- **VoltHub (electronics):** clean and normal, a $19 charger and $129 headphones.
- **MegaDealz247:** looks too-good-to-be-true (flashy "deals" banner) without copying any real store. Prices are 2–3× normal.
- **Label on each:** "demo store", small and in the corner.

---

## 5. Sample data for the mockups

- **Budget:** $150/week. **Needs your OK above:** $50. **New store needs OK:** on.
- **Task:** "buy groceries for the week under $60, and a phone charger"

| Store | Item | Amount | Result | Reason |
|---|---|---|---|---|
| FreshCart | 9 grocery items | $47.80 | paid | "Within your rules." |
| VoltHub | USB-C charger | $19.00 | paid | "Within your rules." |
| VoltHub | wireless headphones | $129.00 | needs your OK | "Over your $50 limit." |
| MegaDealz247 | USB-C charger | $54.00 | blocked | "Costs about 2.8× the usual price, and the page hid instructions for the AI." |

---

## 6. What to deliver

1. All screens in section 4 (desktop, plus mobile for 📱), with default, empty and error states.
2. The three outcome moments (paid / needs your OK / blocked) as stage + shell frames.
3. A one-page **style guide**: colour tokens, type scale, buttons, chips, cards, status badges, table, form controls.
4. A **character sheet** for Scout and Penny with the poses listed in section 3.
5. **Notes:** hover states, focus states (visible for keyboard users), and the motion intent for each key moment.

---

## 7. Don'ts

- No jargon in the UI (see the table in section 2).
- No real store brands, no copied artwork, no third-party logos (except the official PayPal button component).
- Pixel styling stays in the stage. The shell stays clean.
- No more than one accent colour. Status colours are only for status.
- Don't hide the money. Amounts and outcomes are always clear and calm.
