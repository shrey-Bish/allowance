"""Builds index.html and compositions/*.html for the Allowance demo film (1920x1080, 148 s)."""
from pathlib import Path
import json, subprocess

def dur_of(path):
    return round(float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",str(path)]).decode().strip()), 2)

HERE = Path(__file__).resolve().parents[1]
C = HERE / "compositions"; C.mkdir(exist_ok=True)
TOTAL = 148

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

scenes = []  # (id, start, dur)

# ---- 1. hook 0–11: punch into the Agent Cam while Scout heads for the scam store, x-ray, stamp
S = 11
body = "\n".join([
    f'    <div id="hk-wrap" class="wrap" style="z-index:1">{video("hk-v", "07-shop-blocked.mp4", 0, S, 18.6, 1)}</div>',
    chip("hk-chip", "PayPal Sandbox · test money", 0.3, S - 0.3),
])
js = "\n".join([
    '    tl.fromTo("#hk-wrap", {scale: 1.9, x: 38, y: -95}, {scale: 1.9, x: 38, y: -95, duration: 0.01}, 0);',
    '    tl.to("#hk-wrap", {scale: 1.6, x: 32, y: -80, duration: 9.5, ease: "power1.inOut"}, 0.5);',
    fade_in("#hk-chip", 0.3),
    '    tl.to("#hk-wrap", {opacity: 0, duration: 0.3, ease: "power3.in"}, 10.7);',
])
(C / "hook.html").write_text(scene("hook", S, body, js=js, extra_root_attrs="data-layout-allow-overflow")); scenes.append(("hook", 0, S))

# ---- 2. title 11–18
S = 7
body = "\n".join([
    '    <div id="ti-card" class="clip full" data-start="0" data-duration="7" style="background:#F6F1E7">',
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
    '    tl.to("#ti-card", {opacity: 0, duration: 0.3, ease: "power3.in"}, 6.7);',
])
(C / "title.html").write_text(scene("title", S, body, js=js)); scenes.append(("title", 11, S))

# ---- 3. setup 18–36: link PayPal (01) then rules (03)
S = 18
body = "\n".join([
    video("st-link", "01-connect-link.mp4", 0, 5.8, 0.4, 1),
    head("st-h1", "Link PayPal <b>once</b>", 0.2, 5.6),
    chip("st-chip", "PayPal Sandbox · test money", 0.3, 5.5),
    video("st-rules", "03-rules.mp4", 5.8, 12.2, 0.05, 2, 'data-playback-rate="0.93"'),
    head("st-h2", "Then set <b>your rules</b>", 6.0, 12.0),
])
js = "\n".join([fade_in("#st-h1", 0.2), fade_in("#st-chip", 0.3), fade_out("#st-h1", 5.5), fade_out("#st-chip", 5.5),
                '    tl.fromTo("#st-rules", {opacity: 0}, {opacity: 1, duration: 0.25, ease: "power2.out"}, 5.8);',
                fade_in("#st-h2", 6.0), fade_out("#st-h2", 17.6)])
(C / "setup.html").write_text(scene("setup", S, body, js=js)); scenes.append(("setup", 18, S))

# ---- 4. paid 36–52: 04 from 24.5
S = 16
body = "\n".join([
    f'    <div id="pd-wrap" class="wrap" style="z-index:1">{video("pd-v", "04-shop-paid.mp4", 0, S, 26.0, 1)}</div>',
    chip("pd-chip", "PayPal Sandbox · test money", 0.3, S - 0.3),
    head("pd-h", "Within your rules → <b>paid</b>", 3.0, 12.5),
])
js = "\n".join([
    '    tl.fromTo("#pd-wrap", {scale: 1, x: 0, y: 0}, {scale: 1.18, x: 24, y: -59, duration: 6, ease: "power1.inOut"}, 4.0);',
    '    tl.to("#pd-wrap", {scale: 1, x: 0, y: 0, duration: 1.2, ease: "power2.inOut"}, 12.5);',
    fade_in("#pd-chip", 0.3), fade_in("#pd-h", 3.0), fade_out("#pd-h", 15.2),
])
(C / "paid.html").write_text(scene("paid", S, body, js=js, extra_root_attrs="data-layout-allow-overflow")); scenes.append(("paid", 36, S))

# ---- 5. hold 52–63: 05 from 9.0
S = 11
body = "\n".join([
    f'    <div id="hd-wrap" class="wrap" style="z-index:1">{video("hd-v", "05-shop-hold.mp4", 0, S, 10.5, 1)}</div>',
    chip("hd-chip", "PayPal Sandbox · test money", 0.3, S - 0.3),
    head("hd-h", "Over your limit → <b>money on hold</b>", 4.0, 6.7),
])
js = "\n".join(['    tl.fromTo("#hd-wrap", {scale: 1, x: 0, y: 0}, {scale: 1.22, x: 24, y: -61, duration: 5, ease: "power1.inOut"}, 4.5);',
                fade_in("#hd-chip", 0.3), fade_in("#hd-h", 4.0), fade_out("#hd-h", 10.4)])
(C / "hold.html").write_text(scene("hold", S, body, js=js, extra_root_attrs="data-layout-allow-overflow")); scenes.append(("hold", 52, S))

# ---- 6. phone approve 63–76
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
(C / "phone-approve.html").write_text(phone_scene("pa", "06-phone-approve.mp4", 1.6, 11, "Approve on your phone → <b>paid</b>", 0.6, "PayPal Sandbox · test money")); scenes.append(("pa", 63, 11))

# ---- 7. blocked 74–100: 07 from 18.5
S = 26
body = "\n".join([
    f'    <div id="bl-wrap" class="wrap" style="z-index:1">{video("bl-v", "07-shop-blocked.mp4", 0, S, 18.5, 1)}</div>',
    chip("bl-chip", "PayPal Sandbox · test money", 0.3, S - 0.3),
    head("bl-h", "Hidden instructions for the AI → <b>blocked</b>", 10.0, 14.0),
])
js = "\n".join([
    '    tl.fromTo("#bl-wrap", {scale: 1, x: 0, y: 0}, {scale: 1.5, x: 30, y: -75, duration: 1.0, ease: "power2.inOut"}, 3.5);',
    '    tl.to("#bl-wrap", {scale: 1, x: 0, y: 0, duration: 1.2, ease: "power2.inOut"}, 15.0);',
    fade_in("#bl-chip", 0.3), fade_in("#bl-h", 10.0), fade_out("#bl-h", 23.8),
])
(C / "blocked.html").write_text(scene("blocked", S, body, js=js, extra_root_attrs="data-layout-allow-overflow")); scenes.append(("blocked", 74, S))

# ---- 8. edge 100–118: phone decline (10 s) then budget block (8 s)
(C / "phone-decline.html").write_text(phone_scene("pdn", "09-phone-decline.mp4", 2.0, 10, "Say no → <b>hold released</b>", 0.6)); scenes.append(("pdn", 100, 10))
S = 8
body = "\n".join([
    f'    <div id="bg-wrap" class="wrap" style="z-index:1">{video("bg-v", "10-shop-budget.mp4", 0, S, 16.0, 1)}</div>',
    head("bg-h", "Hit your budget → <b>the agent stops</b>", 0.6, 7.0),
])
js = "\n".join(['    tl.fromTo("#bg-wrap", {scale: 1.0}, {scale: 1.0, duration: 0.01}, 0);', fade_in("#bg-h", 0.6), fade_out("#bg-h", 7.5)])
(C / "budget.html").write_text(scene("budget", S, body, js=js)); scenes.append(("budget", 110, S))

# ---- 9. payoff 118–136: plain view, activity, PayPal
S = 18
body = "\n".join([
    video("po-plain", "11-plain-view.mp4", 0, 6, 1.5, 1),
    head("po-h1", "Plain view, <b>no pixels</b>", 0.4, 5.3),
    video("po-act", "12-activity.mp4", 6, 7, 1.5, 2),
    head("po-h2", "Every decision, <b>every PayPal id</b>", 6.3, 6.4),
    f'    <div id="po-ppwrap" class="wrap" style="z-index:3">{video("po-pp", "13-paypal-sandbox.mp4", 13, 5, 17.0, 3)}</div>',
    head("po-h3", "Same payments on <b>PayPal</b>", 13.3, 4.4),
    chip("po-chip", "PayPal Sandbox · test money", 13.2, 4.8),
])
js = "\n".join([fade_in("#po-h1", 0.4), fade_out("#po-h1", 5.5),
                '    tl.fromTo("#po-act", {opacity: 0}, {opacity: 1, duration: 0.25}, 6);', fade_in("#po-h2", 6.3), fade_out("#po-h2", 12.5),
                '    tl.fromTo("#po-ppwrap", {opacity: 0, scale: 1.3, y: -20}, {opacity: 1, scale: 1.3, y: -20, duration: 0.3}, 13);',
                '    tl.to("#po-ppwrap", {y: -70, duration: 4.5, ease: "power1.inOut"}, 13.3);',
                fade_in("#po-h3", 13.3), fade_in("#po-chip", 13.2), fade_out("#po-h3", 17.5)])
(C / "payoff.html").write_text(scene("payoff", S, body, js=js, extra_root_attrs="data-layout-allow-overflow")); scenes.append(("payoff", 118, S))

# ---- 10. end 136–148
S = 12
body = "\n".join([
    '    <div id="en-card" class="clip full" data-start="0" data-duration="12" style="background:#F6F1E7">',
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
(C / "end.html").write_text(scene("end", S, body, js=js)); scenes.append(("end", 136, S))

# ---- sound placements (film seconds): few and caused by what is on screen
SFX = [("sfx-glitch", 5.0, 0.7), ("sfx-door-slam", 6.7, 0.7), ("sfx-stamp", 7.1, 0.8), ("penny-block", 7.9, 0.9),
       ("sfx-coin", 11.7, 0.7),
       ("scout-not-looking", 21.6, 0.8),
       ("sfx-coin", 38.6, 0.7), ("penny-paying", 39.4, 0.9), ("sfx-receipt", 40.4, 0.5), ("sfx-coin", 44.4, 0.6), ("sfx-receipt", 47.2, 0.5),
       ("sfx-jar", 54.6, 0.7), ("penny-hold", 62.0, 0.9),
       ("sfx-coin-rain", 66.6, 0.7),
       ("sfx-glitch", 79.5, 0.8), ("sfx-door-slam", 81.3, 0.7), ("sfx-stamp", 81.7, 0.9), ("penny-xray", 84.0, 0.9),
       ("scout-oh-well", 103.4, 0.8), ("penny-released", 105.4, 0.9),
       ("sfx-stamp", 114.2, 0.8), ("penny-budget", 114.8, 0.9),
       ("sfx-coin", 137.2, 0.7)]

hosts = "\n".join(
    f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{fname}.html" data-start="{st}" data-duration="{du}" data-track-index="{i+1}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>'
    for i, ((sid, st, du), fname) in enumerate(zip(scenes, ["hook", "title", "setup", "paid", "hold", "phone-approve", "blocked", "phone-decline", "budget", "payoff", "end"])))
audio = [f'      <audio id="vo" class="clip" data-start="0" data-duration="{TOTAL}" data-volume="1" data-track-index="20" src="assets/audio/vo.wav"></audio>']
for i, (clip, at, vol) in enumerate(SFX):
    d = dur_of(HERE / "assets/audio/sfx" / f"{clip}.mp3")
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
print("scenes:", [(s, st, du) for s, st, du in scenes], "| sfx:", len(SFX))
