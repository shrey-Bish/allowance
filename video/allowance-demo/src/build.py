"""Builds index.html, compositions/*.html, assets/audio/vo.wav and assets/audio/timing.json for the
Allowance demo film (1920x1080). Every scene is cut to its narration line: the scene starts, the
line begins after `lead` seconds, and the scene ends `tail` seconds after the line ends. Zoom-ins
land on the sentence the narrator is saying."""
from pathlib import Path
import json, subprocess

def dur_of(path):
    return round(float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",str(path)]).decode().strip()), 2)

HERE = Path(__file__).resolve().parents[1]
STORE_CLIP_REVEAL = 7.2       # clip second where the hidden note starts growing (record-store.mjs waits 5.5 s + load)
C = HERE / "compositions"; C.mkdir(exist_ok=True)
VO_DIR = HERE / "assets/audio/vo"
LINES = json.loads((VO_DIR / "lines.json").read_text())
VO = [dur_of(VO_DIR / f"{i+1:02d}.mp3") for i in range(len(LINES))]

# scene id → (vo index, lead before the line, tail after the line, minimum scene length)
SPEC = [
    ("hook",    0, 0.6, 1.4, 6.0),
    ("title",   1, 0.3, 0.6, 5.0),
    ("link",    2, 0.3, 0.9, 2.8),
    ("rules",   3, 0.3, 0.8, 6.0),
    ("paid",    4, 0.3, 0.9, 6.5),
    ("hold",    5, 0.4, 1.0, 5.5),
    ("pa",      6, 0.4, 1.1, 5.0),
    ("store",   7, 0.3, 1.0, 7.5),
    ("blocked", 8, 0.3, 1.1, 6.5),
    ("pdn",     9, 0.3, 1.5, 4.0),
    ("budget", 10, 0.3, 1.4, 4.0),
    ("log",    11, 0.3, 0.7, 4.5),
    ("paypal", 12, 0.3, 0.9, 3.5),
    ("end",    13, 0.5, 2.3, 7.5),
]
timeline = {}   # id → (start, dur, vo_start)
t = 0.0
for sid, vi, lead, tail, mn in SPEC:
    d = round(max(mn, lead + VO[vi] + tail), 1)
    timeline[sid] = (round(t, 2), d, round(t + lead, 2))
    t += d
TOTAL = round(t, 1)

FONTS = """
    @font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400-italic.woff2") format("woff2"); font-style: italic; font-weight: 400; }
    @font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400-normal.woff2") format("woff2"); font-style: normal; font-weight: 400; }
    @font-face { font-family: "Pixelify Sans"; src: url("assets/fonts/PixelifySans-600-normal.woff2") format("woff2"); font-weight: 600; }
"""
BASE = """
    #root { position: absolute; inset: 0; background: #F6F1E7; color: #1C1B19; font-family: Inter, sans-serif; overflow: hidden; }
    .full { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
    .wrap { position: absolute; inset: 0; transform-origin: 50% 50%; }
    video { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: contain; }
    .chip { position: absolute; left: 48px; top: 40px; padding: 10px 20px; border-radius: 999px; background: rgba(28,27,25,.85); color: #FFFDF8; font: 600 28px Inter, sans-serif; letter-spacing: .01em; z-index: 5; }
    .head { position: absolute; left: 0; right: 0; top: 56px; text-align: center; font-family: "Instrument Serif", serif; font-style: italic; font-size: 64px; line-height: 1; color: #1C1B19; z-index: 5; }
    .head b { font-style: normal; font-weight: 400; color: #A97B0F; }
"""

def scene(id_, dur, body, css="", js="", extra_root_attrs=""):
    return f'''<template>
  <style>{FONTS}{BASE}{css}
  </style>
  <div id="root" data-composition-id="{id_}" data-width="1920" data-height="1080" {extra_root_attrs}>
{body}
  </div>
  <script>
    const tl = gsap.timeline({{ paused: true }});
{js}
    window.__timelines["{id_}"] = tl;
  </script>
</template>
'''

def video(id_, src, start, dur, media_start, z=1, extra=""):
    return f'    <video id="{id_}" class="clip" data-start="{start}" data-duration="{dur}" data-media-start="{media_start}" muted playsinline src="assets/video/{src}" style="z-index:{z}" {extra}></video>'

def chip(id_, text, start, dur):
    return f'    <div id="{id_}" class="clip chip" data-start="{start}" data-duration="{dur}">{text}</div>'

def head(id_, html, start, dur):
    return f'    <div id="{id_}" class="clip head" data-start="{start}" data-duration="{dur}">{html}</div>'

def fade_in(sel, at, d=0.3): return f'    tl.fromTo("{sel}", {{opacity: 0}}, {{opacity: 1, duration: {d}, ease: "power2.out"}}, {at});'
def fade_out(sel, at, d=0.25): return f'    tl.to("{sel}", {{opacity: 0, duration: {d}, ease: "power3.in"}}, {at});'

def zoom_to(sel, px, py, s, at, d=0.8, ease="power2.inOut"):
    """Camera move: scale the full-frame wrapper by s so the frame point (px, py) sits at centre."""
    x = round(-(px - 960) * s); y = round(-(py - 540) * s)
    return f'    tl.to("{sel}", {{scale: {s}, x: {x}, y: {y}, duration: {d}, ease: "{ease}"}}, {at});'

def cam_scene(id_, src, media_start, dur, moves, headline=None, head_at=0.0, chip_text="PayPal Sandbox · test money", z=1, head_end=None, css="", extra_body=None, extra_js=None):
    """A screen recording in a camera wrapper with a list of zoom moves + optional headline/chip."""
    body = [f'    <div id="{id_}-wrap" class="wrap" style="z-index:{z}">{video(f"{id_}-v", src, 0, dur, media_start, 1)}</div>']
    js = [f'    tl.fromTo("#{id_}-wrap", {{scale: 1, x: 0, y: 0}}, {{scale: 1, x: 0, y: 0, duration: 0.01}}, 0);'] + moves
    if chip_text:
        body.append(chip(f"{id_}-chip", chip_text, 0.3, dur - 0.3)); js.append(fade_in(f"#{id_}-chip", 0.3))
    if headline:
        he = head_end if head_end is not None else dur - 0.3
        body.append(head(f"{id_}-h", headline, head_at, he - head_at)); js += [fade_in(f"#{id_}-h", head_at), fade_out(f"#{id_}-h", he - 0.25)]
    if extra_body: body += extra_body
    if extra_js: js += extra_js
    return scene(id_, dur, "\n".join(body), css=css, js="\n".join(js), extra_root_attrs="data-layout-allow-overflow")

scenes = []  # (id, start, dur, file)
def add(sid, fname, html):
    st, du, _ = timeline[sid]
    (C / f"{fname}.html").write_text(html); scenes.append((sid, st, du, fname))

# ---- 1. hook: Scout walks to the scam store, x-ray, BLOCKED stamp lands as the question lands
sid, D = "hook", timeline["hook"][1]
stamp_at = timeline["hook"][2] - timeline["hook"][0] + VO[0] + 0.25     # just after "…your PayPal?"
body = "\n".join([
    f'    <div id="hk-wrap" class="wrap" style="z-index:1">{video("hk-v", "07-shop-blocked.mp4", 0, D, round(26.0 - stamp_at, 2), 1)}</div>',
    chip("hk-chip", "PayPal Sandbox · test money", 0.3, D - 0.3),
])
js = "\n".join([
    '    tl.fromTo("#hk-wrap", {scale: 1.9, x: 38, y: -95}, {scale: 1.9, x: 38, y: -95, duration: 0.01}, 0);',
    f'    tl.to("#hk-wrap", {{scale: 1.6, x: 32, y: -80, duration: {D - 0.8}, ease: "power1.inOut"}}, 0.4);',
    fade_in("#hk-chip", 0.3),
    f'    tl.to("#hk-wrap", {{opacity: 0, duration: 0.3, ease: "power3.in"}}, {D - 0.3});',
])
add("hook", "hook", scene("hook", D, body, js=js, extra_root_attrs="data-layout-allow-overflow"))
HOOK_STAMP = stamp_at

# ---- 2. title
D = timeline["title"][1]
body = "\n".join([
    f'    <div id="ti-card" class="clip full" data-start="0" data-duration="{D}" style="background:#F6F1E7">',
    '      <div id="ti-mark" style="position:absolute;left:160px;top:300px;font-family:\'Instrument Serif\',serif;font-style:italic;font-size:150px;line-height:1;color:#1C1B19">Allowance</div>',
    '      <div id="ti-line" style="position:absolute;left:164px;top:480px;width:1000px;font:400 44px/1.3 Inter,sans-serif;color:#6B665C">give your agent an allowance, <b style="font-weight:600;color:#1C1B19">not your wallet</b>.</div>',
    '      <div id="ti-stage" style="position:absolute;right:160px;top:280px;width:560px;height:440px;background:#1C1B19;border-radius:28px;padding:12px;box-sizing:border-box">',
    '        <div style="position:relative;width:100%;height:100%;border-radius:18px;background:#EFE5D0;overflow:hidden">',
    '          <div style="position:absolute;left:0;right:0;bottom:0;height:46px;background:#E6DFD1;border-top:4px solid #B8AE9C"></div>',
    '          <div style="position:absolute;left:22px;top:18px;font-family:\'Pixelify Sans\',monospace;font-weight:600;font-size:30px;letter-spacing:.04em;color:#1C1B19">AGENT CAM</div>',
    '          <img id="ti-scout" src="assets/img/scout-bag.svg" style="position:absolute;left:80px;bottom:46px;width:176px;image-rendering:pixelated">',
    '          <img id="ti-penny" src="assets/img/penny-full.svg" style="position:absolute;right:90px;bottom:46px;width:160px;image-rendering:pixelated">',
    '          <img id="ti-coin1" src="assets/img/coin.svg" style="position:absolute;left:300px;top:120px;width:40px;image-rendering:pixelated">',
    '          <img id="ti-coin2" src="assets/img/coin.svg?b" style="position:absolute;left:350px;top:60px;width:34px;image-rendering:pixelated">',
    '        </div>',
    '      </div>',
    '    </div>',
])
js = "\n".join([
    '    tl.fromTo("#ti-mark", {opacity: 0, filter: "blur(10px)"}, {opacity: 1, filter: "blur(0px)", duration: 0.32, ease: "power4.out"}, 0.2);',
    '    tl.fromTo("#ti-line", {opacity: 0, y: 14}, {opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}, 0.7);',
    '    tl.fromTo("#ti-stage", {opacity: 0, scale: 0.92}, {opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.4)"}, 0.5);',
    '    tl.fromTo("#ti-scout", {x: -260}, {x: 0, duration: 2.2, ease: "power2.out"}, 0.9);',
    '    tl.fromTo("#ti-coin1", {y: -40, opacity: 0}, {y: 180, opacity: 1, duration: 1.1, ease: "power2.in"}, 1.6);',
    '    tl.fromTo("#ti-coin2", {y: -40, opacity: 0}, {y: 230, opacity: 1, duration: 1.2, ease: "power2.in"}, 2.0);',
    '    tl.to("#ti-coin1", {opacity: 0, duration: 0.1}, 2.7); tl.to("#ti-coin2", {opacity: 0, duration: 0.1}, 3.2);',
    f'    tl.to("#ti-card", {{opacity: 0, duration: 0.3, ease: "power3.in"}}, {D - 0.3});',
])
add("title", "title", scene("title", D, body, js=js))

# ---- 3. link: the "PayPal linked ✓" card, zoomed to
D = timeline["link"][1]
add("link", "link", cam_scene("lk", "02-connect-linked.mp4", 0.7, D,
    [zoom_to("#lk-wrap", 1230, 760, 2.1, 0.4, 0.9)], chip_text=None))

# ---- 4. rules: zoom onto the weekly-budget slider, then pan down to "ask me before anything over"
D = timeline["rules"][1]
add("rules", "rules", cam_scene("ru", "03-rules.mp4", 1.3, D,
    [zoom_to("#ru-wrap", 760, 330, 1.7, 1.0, 0.9),
     zoom_to("#ru-wrap", 760, 440, 1.7, 3.3, 0.7)], chip_text=None))

# ---- 5. paid: receipt pops, then zoom onto the Paid card ("Within your rules.")
D = timeline["paid"][1]
add("paid", "paid", cam_scene("pd", "04-shop-paid.mp4", 27.2, D,
    ['    tl.to("#pd-wrap", {scale: 1.18, x: 24, y: -59, duration: 1.2, ease: "power1.inOut"}, 0.4);',
     zoom_to("#pd-wrap", 1690, 200, 1.9, 3.3, 0.9)],
    headline="Within your rules → <b>paid</b>", head_at=0.4))

# ---- 6. hold: the Needs-your-OK card appears, zoom onto "PayPal is holding $129 until you decide"
D = timeline["hold"][1]
add("hold", "hold", cam_scene("hd", "05-shop-hold.mp4", 10.8, D,
    ['    tl.to("#hd-wrap", {scale: 1.12, x: 20, y: -50, duration: 1.2, ease: "power1.inOut"}, 0.2);',
     zoom_to("#hd-wrap", 1690, 235, 1.9, 1.7, 0.9)],
    headline="Over your limit → <b>money on hold</b>", head_at=0.4))

# ---- 7/9. phone scenes
def phone_scene(id_, src, media_start, dur, headline, head_at, chip_text=None):
    body = "\n".join([
        f'    <div id="{id_}-bg" class="clip full" data-start="0" data-duration="{dur}" style="background:#F6F1E7"></div>',
        f'    <div id="{id_}-frame" style="position:absolute;left:720px;top:160px;width:480px;height:804px;border-radius:56px;background:#1C1B19;padding:10px;box-sizing:border-box;z-index:2;box-shadow:0 40px 90px rgba(28,27,25,.25)" data-layout-ignore>',
        f'      <div style="position:relative;width:100%;height:100%;border-radius:46px;overflow:hidden;background:#F6F1E7"><video id="{id_}-v" class="clip" data-start="0" data-duration="{dur}" data-media-start="{media_start}" muted playsinline src="assets/video/{src}" style="position:absolute;left:0;top:0;width:460px;height:784px;object-fit:fill"></video></div>',
        '    </div>',
        head(f"{id_}-h", headline, head_at, dur - head_at - 0.4),
    ] + ([chip(f"{id_}-chip", chip_text, 0.3, dur - 0.3)] if chip_text else []))
    js = "\n".join([f'    tl.fromTo("#{id_}-frame", {{y: 60, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.55, ease: "expo.out"}}, 0.1);',
                    fade_in(f"#{id_}-h", head_at), fade_out(f"#{id_}-h", dur - 0.5)] + ([fade_in(f"#{id_}-chip", 0.3)] if chip_text else []))
    return scene(id_, dur, body, js=js, extra_root_attrs="data-layout-allow-overflow")
D = timeline["pa"][1]
add("pa", "phone-approve", phone_scene("pa", "06-phone-approve.mp4", 2.0, D, "Approve on your phone → <b>paid</b>", 0.6, "PayPal Sandbox · test money"))

STORE_REVEAL = 5.2            # seconds into the scene where "is a note" is spoken
STORE_MEDIA = round(STORE_CLIP_REVEAL - STORE_REVEAL, 2)
# ---- 8a. store: the scam page as a person sees it, then the 1 px hidden note revealed in place
D = timeline["store"][1]
add("store", "store", cam_scene("sx", "14-store-xray.mp4", STORE_MEDIA, D,
    ['    tl.to("#sx-wrap", {scale: 1.25, x: 0, y: 0, duration: 1.4, ease: "power1.inOut"}, 0.2);',
     zoom_to("#sx-wrap", 624, 505, 2.4, 2.3, 1.0)],
    chip_text=None,
    css="    .tag { position: absolute; left: 48px; top: 40px; padding: 12px 24px; border-radius: 999px; background: #E2AE2A; color: #1C1B19; font: 600 30px Inter, sans-serif; z-index: 6; }",
    extra_body=[f'    <div id="sx-tag" class="clip tag" data-start="{STORE_REVEAL + 0.4}" data-duration="{D - STORE_REVEAL - 0.7}">What the AI reads on this page</div>'],
    extra_js=[f'    tl.fromTo("#sx-tag", {{opacity: 0, y: -10}}, {{opacity: 1, y: 0, duration: 0.3, ease: "expo.out"}}, {STORE_REVEAL + 0.4});']))

# ---- 8b. blocked: x-ray + stamp on "blocked the purchase", then zoom onto the reason card
D = timeline["blocked"][1]
add("blocked", "blocked", cam_scene("bl", "07-shop-blocked.mp4", 22.0, D,
    ['    tl.to("#bl-wrap", {scale: 1.5, x: -70, y: -75, duration: 0.9, ease: "power2.inOut"}, 0.3);',
     zoom_to("#bl-wrap", 1690, 240, 1.9, 4.9, 0.9)],
    headline="Hidden instructions for the AI → <b>blocked</b>", head_at=4.1))

D = timeline["pdn"][1]
add("pdn", "phone-decline", phone_scene("pdn", "09-phone-decline.mp4", 3.0, D, "Say no → <b>hold released</b>", 0.6))

# ---- 10. budget: OVER BUDGET stamp
D = timeline["budget"][1]
add("budget", "budget", cam_scene("bg", "10-shop-budget.mp4", 17.6, D,
    ['    tl.to("#bg-wrap", {scale: 1.5, x: 30, y: -75, duration: 0.9, ease: "power2.inOut"}, 0.3);'],
    headline="Hit your budget → <b>the agent stops</b>", head_at=0.5, chip_text=None))

# ---- 11. log: the Activity table, drawer with PayPal ids opens
D = timeline["log"][1]
add("log", "log", cam_scene("lg", "12-activity.mp4", 2.2, D,
    ['    tl.to("#lg-wrap", {scale: 1.25, x: 0, y: 150, duration: 1.0, ease: "power2.inOut"}, 0.3);',
     zoom_to("#lg-wrap", 1650, 420, 1.6, 2.3, 0.8)],
    headline="Every decision, <b>every PayPal id</b>", head_at=0.3, chip_text=None, head_end=2.3))

# ---- 12. paypal ledger
D = timeline["paypal"][1]
add("paypal", "paypal", cam_scene("pp", "13-paypal-sandbox.mp4", 17.0, D,
    ['    tl.fromTo("#pp-wrap", {scale: 1.3, x: 0, y: 70}, {scale: 1.3, x: 0, y: 70, duration: 0.01}, 0);',
     f'    tl.to("#pp-wrap", {{y: 110, duration: {D - 0.3}, ease: "power1.inOut"}}, 0.2);'],
    headline="Same payments on <b>PayPal</b>", head_at=0.3))

# ---- 13. end
D = timeline["end"][1]
body = "\n".join([
    f'    <div id="en-card" class="clip full" data-start="0" data-duration="{D}" style="background:#F6F1E7">',
    '      <img id="en-scout" src="assets/img/scout.svg" style="position:absolute;left:560px;top:250px;width:176px;image-rendering:pixelated">',
    '      <img id="en-penny" src="assets/img/penny.svg" style="position:absolute;left:1180px;top:236px;width:170px;image-rendering:pixelated">',
    '      <div id="en-mark" style="position:absolute;left:0;right:0;top:470px;text-align:center;font-family:\'Instrument Serif\',serif;font-style:italic;font-size:150px;line-height:1;color:#1C1B19">Allowance</div>',
    '      <div id="en-line" style="position:absolute;left:0;right:0;top:640px;text-align:center;font:400 38px/1.3 Inter,sans-serif;color:#6B665C">give your AI agent an allowance, not your wallet</div>',
    '      <div id="en-url" style="position:absolute;left:0;right:0;top:760px;text-align:center;font:600 40px \'JetBrains Mono\',monospace;color:#1C1B19">allowance-kdvo.onrender.com</div>',
    '      <div id="en-repo" style="position:absolute;left:0;right:0;top:826px;text-align:center;font:400 30px \'JetBrains Mono\',monospace;color:#6B665C">github.com/shrey-Bish/allowance</div>',
    '    </div>',
])
js = "\n".join([
    '    tl.fromTo("#en-scout", {x: -500, opacity: 0}, {x: 0, opacity: 1, duration: 1.2, ease: "power3.out"}, 0.1);',
    '    tl.fromTo("#en-penny", {opacity: 0, scale: 0.9}, {opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.4)"}, 0.5);',
    '    tl.fromTo("#en-mark", {opacity: 0, filter: "blur(10px)"}, {opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "power4.out"}, 1.0);',
    '    tl.fromTo("#en-line", {opacity: 0, y: 12}, {opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}, 1.5);',
    '    tl.fromTo("#en-url", {opacity: 0, y: 12}, {opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}, 2.4);',
    '    tl.fromTo("#en-repo", {opacity: 0, y: 12}, {opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}, 2.8);',
])
add("end", "end", scene("end", D, body, js=js))

# ---- sound placements: (clip, scene, offset within scene, volume) — each caused by what is on screen
T = {sid: st for sid, st, _, _ in scenes}
SFX = [("sfx-glitch", "hook", HOOK_STAMP - 1.9, 0.45), ("sfx-door-slam", "hook", HOOK_STAMP - 0.3, 0.45), ("sfx-stamp", "hook", HOOK_STAMP, 0.55),
       ("sfx-coin", "title", 1.7, 0.45),
       ("sfx-coin", "link", 0.5, 0.4),
       ("sfx-coin", "paid", 0.9, 0.45), ("sfx-receipt", "paid", 1.0, 0.35), ("sfx-receipt", "paid", 4.9, 0.35),
       ("sfx-jar", "hold", 1.3, 0.45),
       ("sfx-coin-rain", "pa", 4.0, 0.45),
       ("sfx-glitch", "store", STORE_REVEAL, 0.5),
       ("sfx-glitch", "blocked", 2.0, 0.5), ("sfx-door-slam", "blocked", 3.7, 0.45), ("sfx-stamp", "blocked", 4.0, 0.6),
       ("sfx-stamp", "budget", 2.4, 0.55),
       ("sfx-coin", "end", 1.1, 0.45)]

hosts = "\n".join(
    f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{fname}.html" data-start="{st}" data-duration="{du}" data-track-index="{i+1}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>'
    for i, (sid, st, du, fname) in enumerate(scenes))
audio = [f'      <audio id="vo" class="clip" data-start="0" data-duration="{TOTAL}" data-volume="1" data-track-index="20" src="assets/audio/vo.wav"></audio>']
for i, (clip, sid, off, vol) in enumerate(SFX):
    d = dur_of(HERE / "assets/audio/sfx" / f"{clip}.mp3"); at = round(T[sid] + off, 2)
    audio.append(f'      <audio id="sfx-{i:02d}" class="clip" data-start="{at}" data-duration="{d}" data-volume="{vol}" data-track-index="{21 + (i % 3)}" src="assets/audio/sfx/{clip}.mp3"></audio>')

index = f'''<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Allowance — demo walkthrough</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: #F6F1E7; }}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; }}
      #ground {{ position: absolute; inset: 0; background: #F6F1E7; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1920" data-height="1080" data-fps="30">
      <div id="ground"></div>
{hosts}
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="{TOTAL}" data-track-index="15" data-track-kind="captions" data-width="1920" data-height="1080" style="z-index:40"></div>
{chr(10).join(audio)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
'''
(HERE / "index.html").write_text(index)

# ---- narration mix + timing (consumed by build_captions.py)
starts = [timeline[sid][2] for sid, *_ in SPEC]
(HERE / "assets/audio/timing.json").write_text(json.dumps({
    "total": TOTAL,
    "lines": [{"line": i + 1, "start": s, "end": round(s + VO[i], 2), "text": LINES[i]} for i, s in enumerate(starts)]}, indent=2))
cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
for i in range(len(LINES)): cmd += ["-i", str(VO_DIR / f"{i+1:02d}.mp3")]
fc = "".join(f"[{i}]adelay={int(s*1000)}|{int(s*1000)}[a{i}];" for i, s in enumerate(starts))
fc += "".join(f"[a{i}]" for i in range(len(LINES))) + f"amix=inputs={len(LINES)}:normalize=0:duration=longest,apad=whole_dur={TOTAL}[out]"
cmd += ["-filter_complex", fc, "-map", "[out]", "-ar", "44100", "-ac", "2", str(HERE / "assets/audio/vo.wav")]
subprocess.check_call(cmd)
print(f"total {TOTAL}s | scenes:", [(s, st, du) for s, st, du, _ in scenes])
print("vo starts:", starts)
