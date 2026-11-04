"""Builds compositions/captions.html: 2–4 word groups timed to the narration, the spoken word highlighted.
Words come from assets/audio/transcript.json (timings) matched BY POSITION to the real lines in
assets/audio/vo/lines.json (text), per the HyperFrames captions reference."""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
T = json.loads((HERE / "assets/audio/transcript.json").read_text())
LINES = json.loads((HERE / "assets/audio/vo/lines.json").read_text())
TIMING = json.loads((HERE / "assets/audio/timing.json").read_text())
twords = T if isinstance(T, list) else T["words"]

def tokens(s):  # keep punctuation attached, split on spaces
    return s.split()

# Match transcript words to line words by position within each line's time window.
groups = []  # (start, end, [ (text, start, end) ])
ti = 0
for ln in TIMING["lines"]:
    words = tokens(ln["text"])
    # take as many transcript words as this line has, inside its window (±1.5 s)
    cand = [w for w in twords if ln["start"] - 1.5 <= w["start"] <= ln["end"] + 1.5]
    timed = []
    for k, text in enumerate(words):
        if k < len(cand):
            timed.append((text, cand[k]["start"], cand[k]["end"]))
        else:  # transcript dropped a word: spread the remainder evenly to the line end
            last_end = timed[-1][2] if timed else ln["start"]
            step = max(0.12, (ln["end"] - last_end) / max(1, len(words) - k))
            timed.append((text, last_end, last_end + step))
    # chunk into groups of 2–4, breaking at sentence punctuation
    cur = []
    for w in timed:
        cur.append(w)
        if len(cur) >= 4 or re.search(r"[.?!,:]$", w[0]) and len(cur) >= 2:
            groups.append(cur); cur = []
    if cur:
        if groups and len(cur) == 1: groups[-1].extend(cur)
        else: groups.append(cur)

html, js = [], []
for n, g in enumerate(groups):
    st = round(max(0.1, g[0][1] - 0.08), 2)
    en = round(g[-1][2] + 0.35, 2)
    nxt = groups[n + 1][0][1] - 0.1 if n + 1 < len(groups) else 999
    en = round(min(en, nxt), 2)
    if en - st < 0.4: en = round(st + 0.4, 2)
    spans = "".join(f'<span class="w" id="cw-{n:02d}-{i}">{w[0]}</span>' for i, w in enumerate(g))
    html.append(f'    <div id="cap-{n:02d}" class="clip cap" data-start="{st}" data-duration="{round(en - st, 2)}"><div class="cap-inner">{spans}</div></div>')
    js.append(f'    tl.fromTo("#cap-{n:02d} .cap-inner", {{opacity: 0, y: 10}}, {{opacity: 1, y: 0, duration: 0.14, ease: "power2.out"}}, {st});')
    for i, w in enumerate(g):
        js.append(f'    tl.to("#cw-{n:02d}-{i}", {{color: "var(--hl)", duration: 0.08, ease: "none"}}, {round(max(st, w[1]), 2)});')
    js.append(f'    tl.to("#cap-{n:02d} .cap-inner", {{opacity: 0, duration: 0.12, ease: "power2.in"}}, {round(en - 0.12, 2)});')
    js.append(f'    tl.set("#cap-{n:02d} .cap-inner", {{opacity: 0, visibility: "hidden"}}, {en});')

out = f'''<template>
  <style>
    #root {{ position: absolute; inset: 0; font-family: Inter, sans-serif; --hl: #D9A21B; }}
    .cap {{ position: absolute; left: 0; right: 0; bottom: 96px; text-align: center; overflow: visible; }}
    .cap-inner {{ display: inline-block; padding: 10px 26px; border-radius: 999px; background: rgba(28,27,25,.82); color: #FFFDF8;
      font-size: 40px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }}
    .w {{ display: inline-block; margin: 0 7px; }}
  </style>
  <div id="root" data-composition-id="captions" data-width="1920" data-height="1080">
{chr(10).join(html)}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
    window.__timelines["captions"] = tl;
  </script>
</template>
'''
(HERE / "compositions/captions.html").write_text(out)
print(f"captions: {len(groups)} groups, first at {groups[0][0][1]:.2f}s, last ends {groups[-1][-1][2]:.2f}s")
