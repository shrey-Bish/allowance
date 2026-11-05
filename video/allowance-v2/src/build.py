"""Builds the v2 Allowance demo film from video/SCRIPT.md (1920x1080, about 2:47).

One composition per scene. Scene length follows the generated voice file: 0.3 s before the line, 0.4 s after
(plus the 1 s beat after S01 and the 2 s silent hold on S11). Product scenes are real recordings of the app
(video/recordings-v2, 1280x650 layout) shown in a window on the cream stage; rings and cuts are placed from the
events the recorder logged, and land on the word that names the thing (word times from each voice transcript).
"""
from pathlib import Path
import difflib, json, os, re, subprocess, sys

HERE = Path(__file__).resolve().parents[1]
REC = HERE.parent / os.environ.get("REC_DIR", "recordings-v2")
C = HERE / "compositions"; C.mkdir(exist_ok=True)
VO_DIR = HERE / "assets/audio/vo"
SIDS = [f"S{i:02d}" for i in range(1, 12)]
LEAD, TAIL = 0.3, 0.4
EXTRA = {"S01": 1.0, "S11": 2.0}

def dur_of(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).decode().strip())

LINES = json.loads((VO_DIR / "lines.json").read_text())
VO = {s: round(dur_of(VO_DIR / f"{s}.mp3"), 2) for s in SIDS}
WORDS = {}
for s in SIDS:
    w = json.loads((VO_DIR / f"{s}.words.json").read_text()); WORDS[s] = w if isinstance(w, list) else w["words"]
DUR, START = {}, {}
_t = 0.0
for s in SIDS:
    DUR[s] = round(LEAD + VO[s] + TAIL + EXTRA.get(s, 0), 2); START[s] = round(_t, 2); _t += DUR[s]
TOTAL = round(_t, 2)

norm = lambda x: re.sub(r"[^a-z0-9$]", "", x.lower())
def T(sid, token, nth=1, end=False):
    """Scene-local second at which the nth spoken word starting with `token` begins (or ends)."""
    k = 0; pre = token.endswith("*"); tok = norm(token)
    for w in WORDS[sid]:
        if (norm(w["text"]).startswith(tok) if pre else norm(w["text"]) == tok):
            k += 1
            if k == nth: return round(LEAD + (w["end"] if end else w["start"]), 2)
    raise SystemExit(f"word {token!r} #{nth} not found in {sid}: {' '.join(w['text'] for w in WORDS[sid])}")

def rec(name):
    return json.loads((REC / f"{name}.json").read_text())["events"]
def ev(events, name, nth=1):
    return [e for e in events if e["name"] == name][nth - 1]

# ------------------------------------------------------------------ shared look
W, H = 1920, 1080
WIN = dict(x=220, y=150, w=1480, h=751)          # the product window on the stage
VW, VH = 1280, 650                                # layout the app was recorded at
K = WIN["w"] / VW
NARROW_W = round(860 * K); NARROW_X = WIN["x"] + (WIN["w"] - NARROW_W) // 2   # the app's narrow layout, centred
INK, GOLD, PAPER, MUTED = "#1C1B19", "#A97B0F", "#F6F1E7", "#6B665C"

FONTS = """
    @font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400-italic.woff2") format("woff2"); font-style: italic; font-weight: 400; }
    @font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400-normal.woff2") format("woff2"); font-style: normal; font-weight: 400; }
    @font-face { font-family: "Pixelify Sans"; src: url("assets/fonts/PixelifySans-600-normal.woff2") format("woff2"); font-weight: 600; }
"""
BASE = f"""
    #root {{ position: absolute; inset: 0; background: {PAPER}; color: {INK}; font-family: Inter, sans-serif; overflow: hidden; }}
    .full {{ position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }}
    .super {{ position: absolute; left: 0; right: 0; top: 52px; text-align: center; font-family: "Instrument Serif", serif; font-style: italic; font-size: 66px; line-height: 1.05; color: {INK}; z-index: 20; opacity: 0; }}
    .super b {{ font-weight: 400; color: {GOLD}; }}
    .win {{ position: absolute; left: {WIN['x']}px; top: {WIN['y']}px; width: {WIN['w']}px; height: {WIN['h']}px; border-radius: 22px; overflow: hidden; background: #FFFDF8; z-index: 5; }}
    .winsh {{ position: absolute; top: {WIN['y']}px; height: {WIN['h']}px; border-radius: 22px; background: #FFFDF8; box-shadow: 0 2px 4px rgba(28,27,25,.10), 0 30px 70px rgba(28,27,25,.18); z-index: 4; }}
    .winedge {{ position: absolute; top: {WIN['y']}px; height: {WIN['h']}px; border-radius: 22px; border: 2px solid rgba(28,27,25,.55); box-sizing: border-box; z-index: 6; pointer-events: none; }}
    .cam {{ position: absolute; left: 0; top: 0; width: {VW}px; height: {VH}px; transform-origin: 0 0; }}
    .cam video {{ position: absolute; left: 0; top: 0; width: {VW}px; height: {VH}px; object-fit: fill; }}
    .ring {{ position: absolute; box-sizing: border-box; border: 4px solid #D9A21B; border-radius: 14px; box-shadow: 0 0 0 3px rgba(255,253,248,.95), 0 6px 18px rgba(169,123,15,.35); opacity: 0; z-index: 9; }}
    .chap {{ position: absolute; left: 96px; top: 948px; padding: 9px 18px; border-radius: 999px; border: 2px solid {INK}; background: #FFFDF8; font: 600 24px "JetBrains Mono", monospace; letter-spacing: .06em; color: {INK}; z-index: 20; opacity: 0; }}
    .chap i {{ font-style: normal; color: {GOLD}; margin-right: 10px; }}
    .sbx {{ position: absolute; right: 96px; top: 948px; padding: 10px 18px; border-radius: 999px; background: rgba(28,27,25,.86); color: #FFFDF8; font: 600 24px Inter, sans-serif; z-index: 20; opacity: 0; }}
    .sped {{ position: absolute; left: {WIN['x'] + WIN['w'] - 200}px; top: {WIN['y'] - 54}px; padding: 8px 16px; border-radius: 999px; background: {INK}; color: #FFFDF8; font: 600 24px "JetBrains Mono", monospace; letter-spacing: .04em; z-index: 12; opacity: 0; }}
    .phone {{ position: absolute; width: 372px; height: 760px; border-radius: 50px; background: {INK}; padding: 10px; box-sizing: border-box; box-shadow: 0 30px 80px rgba(28,27,25,.35); z-index: 14; opacity: 0; }}
    .phone .scr {{ position: relative; width: 100%; height: 100%; border-radius: 40px; overflow: hidden; background: {PAPER}; }}
    .phone video {{ position: absolute; left: 0; top: 0; width: 352px; height: 740px; object-fit: cover; object-position: top center; }}
    .tap {{ position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(28,27,25,.88); border: 3px solid #FFFDF8; box-shadow: 0 6px 18px rgba(28,27,25,.35); z-index: 16; opacity: 0; }}
    .rip {{ position: absolute; width: 48px; height: 48px; border-radius: 50%; border: 3px solid {INK}; z-index: 15; opacity: 0; }}
"""

class Scene:
    def __init__(self, sid, cid=None):
        self.sid, self.cid = sid, (cid or sid.lower())
        self.dur = DUR[sid]; self.body, self.js, self.css, self.pre, self.cam_n = [], [], "", "", 0
        self.p = self.cid
    def add(self, html): self.body.append("    " + html)
    def tw(self, js): self.js.append("    " + js)
    def fade(self, sel, at, out, d=0.3):
        self.tw(f'tl.to("{sel}", {{opacity: 1, duration: {d}, ease: "power2.out"}}, {round(at, 2)});')
        if out is not None: self.tw(f'tl.to("{sel}", {{opacity: 0, duration: 0.25, ease: "power2.in"}}, {round(out - 0.25, 2)});')
    def super(self, html, at, out=None, i=0):
        self.add(f'<div id="{self.p}-sup{i}" class="super">{html}</div>')
        self.tw(f'tl.fromTo("#{self.p}-sup{i}", {{opacity: 0, filter: "blur(8px)"}}, {{opacity: 1, filter: "blur(0px)", duration: 0.35, ease: "power3.out"}}, {round(at, 2)});')
        if out is not None: self.tw(f'tl.to("#{self.p}-sup{i}", {{opacity: 0, duration: 0.25, ease: "power2.in"}}, {round(out - 0.25, 2)});')
    def chrome(self, chapter=None, sandbox=True, at=0.3):
        if chapter:
            n, name = chapter
            self.add(f'<div id="{self.p}-chap" class="chap"><i>{n}</i>{name}</div>'); self.fade(f"#{self.p}-chap", at, None)
        if sandbox:
            self.add(f'<div id="{self.p}-sbx" class="sbx">PayPal Sandbox · test money</div>'); self.fade(f"#{self.p}-sbx", at, None)
    # ---- the product window
    def window(self, clips, enter=None, extra_inner=""):
        """clips: (file, scene_start, duration, media_start[, rate]). Returns the camera selector."""
        vids = []
        for i, c in enumerate(clips):
            f, st, du, ms = c[:4]; rate = c[4] if len(c) > 4 else 1
            ra = f' data-playback-rate="{rate}"' if rate != 1 else ""
            vids.append(f'<video id="{self.p}-v{i}" class="clip" data-start="{round(st, 2)}" data-duration="{round(du, 2)}" data-media-start="{round(ms, 2)}"{ra} muted playsinline src="assets/video/{f}.mp4" style="z-index:{i + 1}"></video>')
        p = self.p; wl, ww = WIN["x"], WIN["w"]
        frames = lambda cls: (f'<div id="{p}-{cls}W" class="win{cls}" data-layout-ignore style="left:{wl}px;width:{ww}px"></div>'
                              f'<div id="{p}-{cls}N" class="win{cls}" data-layout-ignore style="left:{NARROW_X}px;width:{NARROW_W}px;opacity:0"></div>')
        self.add(f'{frames("sh")}<div id="{p}-win" class="win" data-layout-ignore><div id="{p}-cam" class="cam">{"".join(vids)}{extra_inner}<!--RINGS--></div></div>{frames("edge")}')
        cam = f"#{p}-cam"
        self.tw(f'tl.set("{cam}", {{scale: {K}, x: 0, y: 0}}, 0);')
        self.tw(f'tl.set("#{p}-win", {{clipPath: "inset(0px 0px 0px 0px round 22px)", x: 0}}, 0);')
        if enter is not None:
            for sel in (f"#{p}-win", f"#{p}-edgeW", f"#{p}-shW"):
                self.tw(f'tl.fromTo("{sel}", {{opacity: 0, y: 40}}, {{opacity: 1, y: 0, duration: 0.55, ease: "expo.out"}}, {enter});')
        return cam
    def narrow(self, at):
        """Switch the window to the app's narrow layout (860 px): the left part of the recording, centred."""
        p = self.p
        self.tw(f'tl.set("#{p}-win", {{clipPath: "inset(0px {WIN["w"] - NARROW_W}px 0px 0px round 22px)", x: {NARROW_X - WIN["x"]}}}, {round(at, 2)});')
        self.tw(f'tl.set(["#{p}-shW", "#{p}-edgeW"], {{opacity: 0}}, {round(at, 2)}); tl.set(["#{p}-shN", "#{p}-edgeN"], {{opacity: 1}}, {round(at, 2)});')
    def wide(self, at):
        p = self.p
        self.tw(f'tl.set("#{p}-win", {{clipPath: "inset(0px 0px 0px 0px round 22px)", x: 0}}, {round(at, 2)});')
        self.tw(f'tl.set(["#{p}-shW", "#{p}-edgeW"], {{opacity: 1}}, {round(at, 2)}); tl.set(["#{p}-shN", "#{p}-edgeN"], {{opacity: 0}}, {round(at, 2)});')
    def push(self, focus, factor, at, d=1.0):
        fx, fy = focus; s = K * factor
        x = min(0, max(WIN["w"] - VW * s, WIN["w"] / 2 - fx * s)); y = min(0, max(WIN["h"] - VH * s, WIN["h"] / 2 - fy * s))
        self.tw(f'tl.to("#{self.p}-cam", {{scale: {round(s, 4)}, x: {round(x, 1)}, y: {round(y, 1)}, duration: {d}, ease: "power2.inOut"}}, {round(at, 2)});')
    def unpush(self, at, d=0.9):
        self.tw(f'tl.to("#{self.p}-cam", {{scale: {K}, x: 0, y: 0, duration: {d}, ease: "power2.inOut"}}, {round(at, 2)});')
    def ring(self, box, at, out, pad=8, radius=14):
        """A gold ring around a box given in recorded-layout pixels; lives inside the camera so it follows pushes."""
        self.cam_n += 1; rid = f"{self.p}-ring{self.cam_n}"
        x, y, w, h = box["x"] - pad, box["y"] - pad, box.get("w", box.get("width")) + 2 * pad, box.get("h", box.get("height")) + 2 * pad
        html = f'<div id="{rid}" class="ring" style="left:{round(x)}px;top:{round(y)}px;width:{round(w)}px;height:{round(h)}px;border-radius:{radius}px"></div><!--RINGS-->'
        for i, b in enumerate(self.body):
            if "<!--RINGS-->" in b: self.body[i] = b.replace("<!--RINGS-->", html, 1); break
        else: raise SystemExit("ring before window")
        self.tw(f'tl.fromTo("#{rid}", {{opacity: 0, scale: 1.12}}, {{opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.6)"}}, {round(at, 2)});')
        self.tw(f'tl.to("#{rid}", {{opacity: 0, duration: 0.25, ease: "power2.in"}}, {round(out - 0.25, 2)});')
    def sped(self, at, d=1.3, narrow=False):
        self.cam_n += 1; sid = f"{self.p}-sped{self.cam_n}"
        pos = f' style="left:{NARROW_X + NARROW_W + 26}px;top:{WIN["y"] + 18}px"' if narrow else ""
        self.add(f'<div id="{sid}" class="sped"{pos}>sped up »</div>'); self.fade(f"#{sid}", at, at + d, 0.15)
    def cam_set(self, at, focus=None, factor=1.0):
        """Jump the camera (no move): used at a cut."""
        s = K * factor
        if focus is None: x = y = 0
        else:
            fx, fy = focus
            x = min(0, max(WIN["w"] - VW * s, WIN["w"] / 2 - fx * s)); y = min(0, max(WIN["h"] - VH * s, WIN["h"] / 2 - fy * s))
        self.tw(f'tl.set("#{self.p}-cam", {{scale: {round(s, 4)}, x: {round(x, 1)}, y: {round(y, 1)}}}, {round(at, 2)});')
    def phone(self, file, start, dur, media_start, x, y, at_in, at_out=None, src_h=844):
        self.cam_n += 1; pid = f"{self.p}-ph{self.cam_n}"
        self.add(f'<div id="{pid}" class="phone" data-layout-ignore style="left:{x}px;top:{y}px"><div class="scr"><video id="{pid}-v" class="clip" data-start="{round(start, 2)}" data-duration="{round(dur, 2)}" data-media-start="{round(media_start, 2)}" muted playsinline src="assets/video/{file}.mp4"></video></div></div>')
        self.tw(f'tl.fromTo("#{pid}", {{opacity: 0, x: 120, rotation: 4}}, {{opacity: 1, x: 0, rotation: 0, duration: 0.6, ease: "expo.out"}}, {round(at_in, 2)});')
        if at_out is not None: self.tw(f'tl.to("#{pid}", {{opacity: 0, x: 120, duration: 0.4, ease: "power3.in"}}, {round(at_out, 2)});')
        return pid
    def tap(self, x, y, w, h, t):
        """Touch pointer slides onto a button centred at (x, y) in frame pixels and presses at t."""
        self.cam_n += 1; n = self.cam_n; p = self.p
        self.add(f'<div id="{p}-hl{n}" class="ring" data-layout-ignore style="left:{x - w // 2 - 6}px;top:{y - h // 2 - 6}px;width:{w + 12}px;height:{h + 12}px;border-radius:999px;border-color:{INK};z-index:15"></div>')
        self.add(f'<div id="{p}-rip{n}" class="rip" data-layout-ignore style="left:{x - 24}px;top:{y - 24}px"></div>')
        self.add(f'<div id="{p}-tap{n}" class="tap" data-layout-ignore style="left:{x - 23}px;top:{y - 23}px"></div>')
        self.tw(f'tl.fromTo("#{p}-tap{n}", {{opacity: 0, x: 130, y: 150, scale: 1}}, {{opacity: 1, x: 0, y: 0, duration: 0.55, ease: "expo.out"}}, {round(t - 0.7, 2)});')
        self.tw(f'tl.to("#{p}-tap{n}", {{scale: 0.72, duration: 0.09, ease: "power2.in"}}, {t});')
        self.tw(f'tl.to("#{p}-tap{n}", {{scale: 1, duration: 0.16, ease: "back.out(2)"}}, {round(t + 0.09, 2)});')
        self.tw(f'tl.to("#{p}-tap{n}", {{opacity: 0, duration: 0.25, ease: "power3.in"}}, {round(t + 0.35, 2)});')
        self.tw(f'tl.fromTo("#{p}-rip{n}", {{opacity: 0.9, scale: 1}}, {{opacity: 0, scale: 2.8, duration: 0.55, ease: "power2.out", immediateRender: false}}, {t});')
        self.tw(f'tl.to("#{p}-hl{n}", {{opacity: 1, duration: 0.12, ease: "power2.out"}}, {round(t - 0.05, 2)});')
        self.tw(f'tl.to("#{p}-hl{n}", {{opacity: 0, duration: 0.3, ease: "power2.in"}}, {round(t + 0.6, 2)});')
    def write(self):
        html = f'''<template>
  <style>{FONTS}{BASE}{self.css}
  </style>
  <div id="root" data-composition-id="{self.cid}" data-width="1920" data-height="1080" data-layout-allow-overflow data-layout-allow-overlap>
{chr(10).join(self.body)}
  </div>
  <script>
  (function () {{
{self.pre}
    const tl = gsap.timeline({{ paused: true }});
{chr(10).join(self.js)}
    window.__timelines["{self.cid}"] = tl;
  }})();
  </script>
</template>
'''
        (C / f"{self.cid}.html").write_text(html.replace("<!--RINGS-->", ""))
        return self

STREET = (HERE / "src/street.js").read_text() + r"""
S['scout-eyes']=over(SCOUT,[".kkkk.kkkk.","kooookooook",".kkkk.kkkk."],0,4);
var WALLET=[".kkkk.","kBBBBk","kBggBk","kBBBBk",".kkkk."];
S['scout-wallet']=over(SCOUT,WALLET,10,10);S['scout-wallet-a']=over(setR(SCOUT,WA),WALLET,10,10);S['scout-wallet-b']=over(setR(SCOUT,WB),WALLET,10,10);
var NOTE=["kkkkkkkk","kcccccck","kcmmmcrk","kcccccck","kkkkkkkk"];
function path(kf,t){if(t<=kf[0][0])return kf[0][1];for(var i=1;i<kf.length;i++){if(t<kf[i][0]){var a=kf[i-1],b=kf[i];return a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]);}}return kf[kf.length-1][1];}
function moving(kf,t){for(var i=1;i<kf.length;i++){if(t>=kf[i-1][0]&&t<kf[i][0])return kf[i][1]!==kf[i-1][1];}return false;}
"""
def drive(render_call):
    """Canvas scenes: redraw from timeline time on every seek."""
    return f'var __p = {{v: 0}}; tl.to(__p, {{v: 1, duration: DUR, ease: "none", onUpdate: function () {{ {render_call}(tl.time()); }}}}, 0); {render_call}(0);'

scenes = []

# ================================================================== S01 cold open: the pixel street
def s01():
    s = Scene("S01")
    t_wallet, t_note, t_sup = T("S01", "wallet"), T("S01", "believe"), T("S01", "would") - 0.25
    t_stop = round(t_note + 0.5, 2)
    signs = "".join(
        f'<div id="s01-sign{i}" style="position:absolute;left:{(x + 5) * 10}px;top:390px;width:420px;height:70px;display:flex;align-items:center;justify-content:center;font-family:\'Pixelify Sans\',monospace;font-weight:600;font-size:{fs}px;line-height:1;color:{ink};white-space:nowrap;letter-spacing:.02em;z-index:2">{name}</div>'
        for i, (x, name, fs, ink) in enumerate([(8, "FreshCart", 61, "#FFFDF8"), (70, "VoltHub", 61, "#FFFDF8"), (132, "MegaDealz247", 43, INK)]))
    s.add('<canvas id="s01-cv" width="1920" height="1080" style="position:absolute;left:0;top:0;width:1920px;height:1080px;image-rendering:pixelated;z-index:1"></canvas>')
    s.add(signs)
    s.add('<div id="s01-wtag" style="position:absolute;left:0;top:640px;padding:6px 14px;background:#FFFDF8;border:4px solid #1C1B19;font-family:\'Pixelify Sans\',monospace;font-weight:600;font-size:34px;line-height:1;color:#1C1B19;z-index:3;opacity:0">wallet</div>')
    s.add('<div id="s01-q" style="position:absolute;left:1430px;top:590px;font-family:\'Pixelify Sans\',monospace;font-weight:600;font-size:72px;line-height:1;color:#1C1B19;z-index:3;opacity:0">?</div>')
    s.add('<div id="s01-veil" class="full" style="background:linear-gradient(#EFE5D0 0%, rgba(239,229,208,.0) 100%);height:230px;z-index:4;opacity:0"></div>')
    s.super("Would you hand an AI <b>your PayPal?</b>", t_sup)
    s.css = "    #s01-sup0 { top: 64px; font-size: 84px; }"
    s.pre = STREET + f"""
    var DUR = {s.dur}, KF = [[0,-18],[2.9,34],[5.7,88],[7.5,104],[{t_wallet + 0.8},120],[{t_stop},133]], T_NOTE = {t_note}, T_FREEZE = {t_sup + 0.6};
    var cv = document.getElementById("s01-cv"), ctx = cv.getContext("2d"), sign2 = document.getElementById("s01-sign2"), wtag = document.getElementById("s01-wtag");
    function render(t) {{
      var tt = Math.min(t, T_FREEZE), x = path(KF, t), mv = moving(KF, t);
      var st = {{fill: 1, coins: [], scout: {{x: x, pose: mv ? "scout-wallet-" + wk(t) : "scout-wallet"}}}};
      ctx.setTransform(10, 0, 0, 10, 0, 0); ctx.imageSmoothingEnabled = false; draw(ctx, st, tt);
      var u = cl((t - T_NOTE) / 0.9);
      if (u > 0) {{ ctx.save(); ctx.beginPath(); ctx.rect(0, GY, 192, 22); ctx.clip(); blit(ctx, NOTE, 153, lp(GY - 5, GY + 2, u)); ctx.restore(); }}
      sign2.style.color = Math.floor(tt * 3) % 2 ? "#D2483C" : "#1C1B19";
      wtag.style.left = (Math.round(x) * 10 + 96) + "px";
    }}
"""
    s.tw(drive("render"))
    s.tw(f'tl.fromTo("#s01-wtag", {{opacity: 0, y: 14}}, {{opacity: 1, y: 0, duration: 0.3, ease: "back.out(2)"}}, {t_wallet - 0.1});')
    s.tw(f'tl.to("#s01-wtag", {{opacity: 0, duration: 0.25}}, {t_stop + 1.3});')
    s.tw(f'tl.fromTo("#s01-q", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.3, ease: "back.out(2)"}}, {round(t_stop + 0.5, 2)});')
    s.tw(f'tl.to("#s01-veil", {{opacity: 1, duration: 0.4}}, {t_sup - 0.1});')
    scenes.append(s.write())

# ================================================================== S02 title, S03 setup, S11 end: the cast on the cream stage
ACTOR_JS = STREET + """
    function actor(ctx, pose, x, y, sc, fill) { ctx.setTransform(sc, 0, 0, sc, 0, 0); blit(ctx, get(pose, fill == null ? 1 : fill), x / sc, y / sc); }
"""
def stage_title(s, mark_top=250, size=170, tagline="give your agent an allowance, <b>not your wallet</b>."):
    s.add(f'<div id="{s.p}-mark" style="position:absolute;left:0;right:0;top:{mark_top}px;text-align:center;font-family:\'Instrument Serif\',serif;font-style:italic;font-size:{size}px;line-height:1;color:{INK};z-index:3">Allowance</div>')
    s.add(f'<div id="{s.p}-line" style="position:absolute;left:0;right:0;top:{mark_top + size + 26}px;text-align:center;font:400 44px/1.3 Inter,sans-serif;color:{MUTED};z-index:3">{tagline}</div>')
    s.css += f"\n    #{s.p}-line b {{ font-weight: 600; color: {INK}; }}"

CAST_Y = 800      # feet line of the cast on the stage (frame px)
def s02():
    s = Scene("S02")
    stage_title(s)
    s.add('<canvas id="s02-cv" width="1920" height="1080" style="position:absolute;left:0;top:0;width:1920px;height:1080px;image-rendering:pixelated;z-index:2"></canvas>')
    s.pre = ACTOR_JS + f"""
    var DUR = {s.dur}, SC = 12, KS = [[0.5,-220],[3.0,620]], KP = [[1.1,1960],[3.4,1110]];
    var cv = document.getElementById("s02-cv"), ctx = cv.getContext("2d");
    function render(t) {{
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1920, 1080); ctx.imageSmoothingEnabled = false;
      var sx = path(KS, t), px = path(KP, t), bob = moving(KP, t) && Math.floor(t / 0.16) % 2 ? SC : 0;
      actor(ctx, moving(KS, t) ? "scout-walk-" + wk(t) : "scout", sx, {CAST_Y} - 16 * SC, SC);
      actor(ctx, "penny", px, {CAST_Y} - 19 * SC - bob, SC, 1);
    }}
"""
    s.tw(drive("render"))
    s.tw(f'tl.fromTo("#s02-mark", {{clipPath: "inset(0 100% 0 0)"}}, {{clipPath: "inset(0 0% 0 0)", duration: 1.0, ease: "power2.inOut"}}, {T("S02", "built") - 0.2});')
    s.tw(f'tl.fromTo("#s02-line", {{opacity: 0, y: 14}}, {{opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}}, {T("S02", "you") - 0.1});')
    scenes.append(s.write())

def s03():
    s = Scene("S03")
    L, R = rec("linked"), rec("rules")
    t_scout, t_penny = T("S03", "scout") + 0.15, T("S03", "penny") + 0.1
    t_win = round(T("S03", "I") - 0.45, 2)            # "I link my PayPal once"
    t_rules = round(T("S03", "then") - 0.15, 2)       # "Then I set two rules"
    t_eyes = round(T("S03", "scout", 3) - 0.1, 2)     # "Scout never sees it"
    stage_title(s)
    s.add('<canvas id="s03-cv" width="1920" height="1080" style="position:absolute;left:0;top:0;width:1920px;height:1080px;image-rendering:pixelated;z-index:8"></canvas>')
    tag = "position:absolute;top:520px;padding:12px 26px;border-radius:999px;background:#FFFDF8;border:3px solid #1C1B19;font:600 34px Inter,sans-serif;color:#1C1B19;white-space:nowrap;z-index:9;opacity:0"
    s.add(f'<div id="s03-tagS" style="{tag};left:480px"><span style="color:{GOLD}">Scout</span> · does the shopping</div>')
    s.add(f'<div id="s03-tagP" style="{tag};left:1010px"><span style="color:{GOLD}">Penny</span> · holds the money</div>')
    s.add('<div id="s03-nl" style="position:absolute;left:350px;top:84px;padding:6px 14px;background:#FFFDF8;border:3px solid #1C1B19;font-family:\'Pixelify Sans\',monospace;font-weight:600;font-size:28px;line-height:1;color:#1C1B19;z-index:9;opacity:0">not looking!</div>')
    load_l = ev(L, "loaded")["t"]; load_r = ev(R, "loaded")["t"]
    s.window([("linked", t_win, t_rules - t_win, load_l + 1.2), ("rules", t_rules, s.dur - t_rules, load_r + 1.2)], enter=t_win)
    s.super("Link once. <b>Set two rules.</b>", t_win + 0.35)
    s.chrome(sandbox=True, at=t_win + 0.3)
    b = ev(L, "boxes")
    s.ring(b["card"], T("S03", "link") + 0.2, t_rules - 0.05, pad=6, radius=18)
    rb = ev(R, "boxes")
    s.ring(rb["Weekly budget"]["group"], T("S03", "$250"), T("S03", "anything") - 0.1, pad=12)
    s.ring(rb["Ask me before anything over"]["group"], T("S03", "over"), s.dur - 0.15, pad=12)
    s.pre = ACTOR_JS + f"""
    var DUR = {s.dur}, T_WIN = {t_win}, T_EYES = {t_eyes}, T_RULES = {t_rules};
    var cv = document.getElementById("s03-cv"), ctx = cv.getContext("2d");
    function render(t) {{
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1920, 1080); ctx.imageSmoothingEnabled = false;
      if (t < T_WIN + 0.15) {{
        var hopS = t > {t_scout} && t < {t_scout} + 0.3 ? -12 * Math.sin(Math.PI * (t - {t_scout}) / 0.3) : 0, hopP = t > {t_penny} && t < {t_penny} + 0.3 ? -12 * Math.sin(Math.PI * (t - {t_penny}) / 0.3) : 0;
        actor(ctx, "scout", 620, {CAST_Y} - 16 * 12 + hopS * 2, 12); actor(ctx, "penny", 1110, {CAST_Y} - 19 * 12 + hopP * 2, 12, 1);
      }} else {{
        var u = cl((t - T_WIN - 0.15) / 0.35), drop = Math.round((1 - u) * -90 / 5) * 5, a = cl((t - T_WIN - 0.15) / 0.2);
        ctx.globalAlpha = a;
        actor(ctx, t > T_EYES && t < T_RULES ? "scout-eyes" : "scout", 250, {WIN['y']} - 16 * 5 + drop, 5);
        actor(ctx, "penny", 1590, {WIN['y']} - 19 * 5 + drop, 5, 1);
        ctx.globalAlpha = 1;
      }}
    }}
"""
    s.tw(drive("render"))
    for sel, at in (("#s03-tagS", t_scout), ("#s03-tagP", t_penny)):
        s.tw(f'tl.fromTo("{sel}", {{opacity: 0, y: 18, scale: 0.9}}, {{opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.8)"}}, {at});')
        s.tw(f'tl.to("{sel}", {{opacity: 0, duration: 0.25}}, {t_win - 0.25});')
    for sel in ("#s03-mark", "#s03-line"):
        s.tw(f'tl.to("{sel}", {{opacity: 0, duration: 0.3, ease: "power2.in"}}, {t_win - 0.3});')
    s.tw(f'tl.to("#s03-nl", {{opacity: 1, duration: 0.2}}, {t_eyes + 0.1});'); s.tw(f'tl.to("#s03-nl", {{opacity: 0, duration: 0.2}}, {t_rules - 0.2});')
    scenes.append(s.write())

# ================================================================== S09 how it decides: a diagram built as the narrator speaks
def s09():
    s = Scene("S09")
    card = "position:absolute;box-sizing:border-box;border-radius:22px;background:#FFFDF8;border:3px solid #1C1B19;"
    lab = "font:600 36px Inter,sans-serif;color:#1C1B19;"
    sub = f"font:400 27px/1.3 Inter,sans-serif;color:{MUTED};"
    y0 = 430                                   # top of the Me / Scout / PayPal cards
    s.add(f'<div id="s09-me" style="{card}left:96px;top:{y0}px;width:200px;height:260px;opacity:0"><div style="position:absolute;left:0;right:0;top:36px;text-align:center;font-size:88px;line-height:1">🙂</div><div style="position:absolute;left:0;right:0;top:156px;text-align:center;{lab}">Me</div><div style="position:absolute;left:0;right:0;top:204px;text-align:center;{sub}">asks</div></div>')
    s.add(f'<div id="s09-sc" style="{card}left:366px;top:{y0}px;width:220px;height:260px;opacity:0"><canvas id="s09-cvS" width="96" height="96" style="position:absolute;left:62px;top:36px;width:96px;height:96px;image-rendering:pixelated"></canvas><div style="position:absolute;left:0;right:0;top:156px;text-align:center;{lab}">Scout</div><div style="position:absolute;left:0;right:0;top:204px;text-align:center;{sub}">shops, asks</div></div>')
    s.add(f'<div id="s09-pn" style="{card}left:656px;top:{y0 - 120}px;width:600px;height:480px;opacity:0"><canvas id="s09-cvP" width="96" height="114" style="position:absolute;left:28px;top:22px;width:80px;height:95px;image-rendering:pixelated"></canvas><div style="position:absolute;left:128px;top:30px;{lab}">Penny\'s two checks</div><div style="position:absolute;left:128px;top:80px;{sub}">every purchase, in this order</div></div>')
    chk = "position:absolute;left:684px;width:544px;height:136px;box-sizing:border-box;border-radius:18px;border:3px solid #B8AE9C;background:#F6F1E7;opacity:0;"
    s.add(f'<div id="s09-c1" style="{chk}top:{y0 + 24}px"><div style="position:absolute;left:24px;top:24px;font:600 28px \'JetBrains Mono\',monospace;color:{GOLD}">1</div><div style="position:absolute;left:66px;top:18px;{lab}">My rules</div><div style="position:absolute;left:66px;top:74px;{sub}">plain code · budget, limit, stores</div></div>')
    s.add(f'<div id="s09-c2" style="{chk}top:{y0 + 184}px"><div style="position:absolute;left:24px;top:24px;font:600 28px \'JetBrains Mono\',monospace;color:{GOLD}">2</div><div style="position:absolute;left:66px;top:18px;{lab}">Safety check · a second AI</div><div style="position:absolute;left:66px;top:74px;{sub}">reads the store page as untrusted</div></div>')
    s.add(f'<div id="s09-dial" style="position:absolute;left:684px;top:{y0 + 392}px;width:544px;height:90px;opacity:0"><div style="position:absolute;left:0;top:26px;width:544px;height:10px;border-radius:5px;background:#E6DFD1"></div><div id="s09-dfill" style="position:absolute;left:272px;top:26px;width:272px;height:10px;border-radius:5px;background:{GOLD};transform-origin:0 50%"></div><div id="s09-knob" style="position:absolute;left:258px;top:14px;width:28px;height:34px;border-radius:8px;background:#1C1B19"></div><div id="s09-loose" style="position:absolute;left:0;top:52px;{sub}">looser</div><div id="s09-strike" style="position:absolute;left:-6px;top:69px;width:100px;height:4px;background:#D2483C;transform-origin:0 50%"></div><div style="position:absolute;right:0;top:52px;font:600 27px Inter,sans-serif;color:{INK}">stricter only</div></div>')
    s.add(f'<div id="s09-pp" style="{card}left:1574px;top:{y0}px;width:250px;height:260px;opacity:0"><div style="position:absolute;left:0;right:0;top:60px;text-align:center;font:700 56px Inter,sans-serif;color:#1C1B19">PayPal</div><div style="position:absolute;left:0;right:0;top:150px;text-align:center;{sub}">moves<br>the money</div></div>')
    arrow = lambda i, x, y, w: f'<div id="s09-a{i}" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:4px;background:#1C1B19;transform-origin:0 50%;opacity:0"><div style="position:absolute;right:-2px;top:-9px;border-left:16px solid #1C1B19;border-top:11px solid transparent;border-bottom:11px solid transparent"></div></div>'
    s.add(arrow(1, 304, y0 + 128, 54)); s.add(arrow(2, 594, y0 + 128, 54))
    exits = [("pays now", y0 + 50, True), ("holds", y0 + 130, True), ("nothing charged", y0 + 210, False)]
    for i, (txt, yy, reach) in enumerate(exits):
        col = "#1C1B19" if reach else "#D2483C"
        head = f'<div style="position:absolute;left:{292 if reach else 196}px;top:9px;border-left:16px solid {col};border-top:11px solid transparent;border-bottom:11px solid transparent"></div>' if reach else f'<div style="position:absolute;left:200px;top:-4px;font:700 40px Inter,sans-serif;color:{col};line-height:1">×</div>'
        s.add(f'<div id="s09-e{i}" style="position:absolute;left:1264px;top:{yy}px;width:310px;height:40px;opacity:0"><div style="position:absolute;left:0;top:18px;width:{296 if reach else 196}px;height:4px;background:{col}"></div>{head}<div style="position:absolute;left:8px;top:-20px;font:600 26px Inter,sans-serif;color:{col};white-space:nowrap">{txt}</div></div>')
    s.add(f'<div id="s09-arc" style="position:absolute;left:476px;top:{y0 - 250}px;width:1223px;height:250px;box-sizing:border-box;border:4px dashed #B8AE9C;border-bottom:none;border-radius:230px 230px 0 0;opacity:0"></div>')
    s.add(f'<div id="s09-arcl" style="position:absolute;left:1090px;top:{y0 - 232}px;width:290px;text-align:right;font:600 26px Inter,sans-serif;color:{MUTED};opacity:0;white-space:nowrap">straight to PayPal</div>')
    s.add(f'<div id="s09-wall" style="position:absolute;left:1420px;top:{y0 - 290}px;width:30px;height:210px;border-radius:8px;background:#1C1B19;opacity:0"></div>')
    s.super("Two checks. <b>It can only get stricter.</b>", T("S09", "two") - 0.1)
    s.chrome(chapter=("06", "HOW IT DECIDES"), sandbox=False)
    s.pre = ACTOR_JS + """
    (function () { var a = document.getElementById("s09-cvS").getContext("2d"); a.imageSmoothingEnabled = false; actor(a, "scout", 0, 0, 6);
      var b = document.getElementById("s09-cvP").getContext("2d"); b.imageSmoothingEnabled = false; actor(b, "penny", 0, 0, 6, 1); })();
"""
    pop = lambda sel, at: s.tw(f'tl.fromTo("{sel}", {{opacity: 0, y: 24}}, {{opacity: 1, y: 0, duration: 0.45, ease: "expo.out"}}, {round(at, 2)});')
    grow = lambda sel, at: s.tw(f'tl.fromTo("{sel}", {{opacity: 1, scaleX: 0}}, {{opacity: 1, scaleX: 1, duration: 0.3, ease: "power2.out"}}, {round(at, 2)});')
    pop("#s09-me", 0.35); grow("#s09-a1", 0.75); pop("#s09-sc", 0.9); grow("#s09-a2", T("S09", "every")); pop("#s09-pn", T("S09", "every") + 0.2); pop("#s09-pp", T("S09", "two") + 0.1)
    for i, tok in ((1, "my"), (2, "second")):
        at = T("S09", tok) - 0.05
        s.tw(f'tl.fromTo("#s09-c{i}", {{opacity: 0, x: -20}}, {{opacity: 1, x: 0, duration: 0.4, ease: "expo.out"}}, {at});')
        s.tw(f'tl.to("#s09-c{i}", {{borderColor: "#D9A21B", backgroundColor: "#FFF7E0", duration: 0.3}}, {round(at + 0.35, 2)});')
    pop("#s09-dial", T("S09", "only") - 0.3)
    s.tw('tl.set("#s09-dfill", {scaleX: 0}, 0); tl.set("#s09-strike", {scaleX: 0}, 0);')
    s.tw(f'tl.to("#s09-knob", {{x: 230, duration: 0.9, ease: "power2.inOut"}}, {T("S09", "stricter") - 0.3}); tl.to("#s09-dfill", {{scaleX: 0.85, duration: 0.9, ease: "power2.inOut"}}, {T("S09", "stricter") - 0.3});')
    s.tw(f'tl.to("#s09-strike", {{scaleX: 1, duration: 0.3, ease: "power2.out"}}, {T("S09", "never")}); tl.to("#s09-loose", {{opacity: 0.45, duration: 0.3}}, {T("S09", "never")});')
    for i in range(3): pop(f"#s09-e{i}", T("S09", "answer") + i * 0.22)
    t_wall = T("S09", "never", 2)
    s.tw(f'tl.to("#s09-arc", {{opacity: 1, duration: 0.4}}, {round(t_wall - 0.9, 2)}); tl.to("#s09-arcl", {{opacity: 1, duration: 0.4}}, {round(t_wall - 0.8, 2)});')
    s.tw(f'tl.set("#s09-wall", {{opacity: 1}}, {t_wall}); tl.fromTo("#s09-wall", {{y: -420}}, {{y: 0, duration: 0.35, ease: "power4.in", immediateRender: false}}, {t_wall});')
    s.tw(f'tl.to("#s09-arcl", {{color: "#D2483C", duration: 0.2}}, {round(t_wall + 0.35, 2)}); tl.to("#s09-arc", {{borderColor: "#D2483C", duration: 0.2}}, {round(t_wall + 0.35, 2)});')
    scenes.append(s.write())
    return t_wall

# ================================================================== S11 end card
def s11():
    s = Scene("S11")
    stage_title(s, mark_top=130, size=170, tagline="give your AI agent an allowance, not your wallet")
    s.add(f'<div id="s11-url" style="position:absolute;left:0;right:0;top:432px;text-align:center;font:600 42px \'JetBrains Mono\',monospace;color:{INK};z-index:3;opacity:0">allowance-kdvo.onrender.com</div>')
    s.add(f'<div id="s11-repo" style="position:absolute;left:0;right:0;top:500px;text-align:center;font:400 32px \'JetBrains Mono\',monospace;color:{MUTED};z-index:3;opacity:0">github.com/shrey-Bish/allowance</div>')
    s.add(f'<div id="s11-note" style="position:absolute;left:0;right:0;top:568px;text-align:center;font:400 26px Inter,sans-serif;color:{MUTED};z-index:3;opacity:0">PayPal AI Hackathon · sandbox, test money only</div>')
    s.add('<canvas id="s11-cv" width="1920" height="1080" style="position:absolute;left:0;top:0;width:1920px;height:1080px;image-rendering:pixelated;z-index:2"></canvas>')
    s.pre = ACTOR_JS + f"""
    var DUR = {s.dur}, SC = 10, FEET = 880, KS = [[0.4,-200],[4.4,980]], KP = [[1.2,-420],[5.0,760]];
    var cv = document.getElementById("s11-cv"), ctx = cv.getContext("2d");
    function render(t) {{
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1920, 1080); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#B8AE9C"; ctx.fillRect(360, FEET, 1200, 4);
      var sx = path(KS, t), px = path(KP, t), bob = moving(KP, t) && Math.floor(t / 0.16) % 2 ? SC : 0;
      actor(ctx, "penny", px, FEET - 19 * SC - bob, SC, 0.7);
      actor(ctx, moving(KS, t) ? "scout-bag-" + wk(t) : "scout-bag", sx, FEET - 16 * SC, SC);
    }}
"""
    s.tw(drive("render"))
    s.tw('tl.fromTo("#s11-mark", {opacity: 0, filter: "blur(10px)"}, {opacity: 1, filter: "blur(0px)", duration: 0.4, ease: "power4.out"}, 0.2);')
    s.tw('tl.fromTo("#s11-line", {opacity: 0, y: 12}, {opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}, 0.7);')
    s.tw(f'tl.fromTo("#s11-url", {{opacity: 0, y: 12}}, {{opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}}, {T("S11", "it")});')
    s.tw(f'tl.fromTo("#s11-repo", {{opacity: 0, y: 12}}, {{opacity: 1, y: 0, duration: 0.5, ease: "expo.out"}}, {T("S11", "it") + 0.3});')
    s.tw(f'tl.to("#s11-note", {{opacity: 1, duration: 0.5}}, {T("S11", "let")});')
    scenes.append(s.write())

def build_captions():
    """2–3 spoken words at a time, in the bottom band below the window; the word being said turns gold.
    Text is the script's own words; timing comes from each voice transcript (aligned, numbers interpolated)."""
    groups = []
    for sid in SIDS:
        script, tw = LINES[sid].split(), WORDS[sid]
        a, b = [norm(x) for x in script], [norm(w["text"]) for w in tw]
        times = [None] * len(script)
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if tag == "equal":
                for k in range(i2 - i1): times[i1 + k] = (tw[j1 + k]["start"], tw[j1 + k]["end"])
            elif i2 > i1:
                if j2 > j1: t0, t1 = tw[j1]["start"], tw[j2 - 1]["end"]
                else:
                    t0 = tw[j1 - 1]["end"] if j1 > 0 else 0.0; t1 = tw[j1]["start"] if j1 < len(tw) else t0 + 0.3 * (i2 - i1)
                n = i2 - i1
                for k in range(n): times[i1 + k] = (t0 + (t1 - t0) * k / n, t0 + (t1 - t0) * (k + 1) / n)
        base = START[sid] + LEAD
        words = [(w, round(base + t[0], 2), round(base + t[1], 2)) for w, t in zip(script, times)]
        cur = []
        for w in words:
            cur.append(w)
            if len(cur) >= 3 or (re.search(r"[.?!,:…]$", w[0]) and len(cur) >= 2): groups.append(cur); cur = []
        if cur:
            if groups and len(cur) == 1 and len(groups[-1]) <= 3 and groups[-1][-1][1] > base: groups[-1] = groups[-1] + cur
            else: groups.append(cur)
    html, js = [], []
    for n, g in enumerate(groups):
        st = round(max(0.05, g[0][1] - 0.06), 2); en = round(g[-1][2] + 0.3, 2)
        if n + 1 < len(groups): en = round(min(en, groups[n + 1][0][1] - 0.07), 2)
        if en - st < 0.35: en = round(st + 0.35, 2)
        spans = "".join(f'<span class="w" id="cw-{n:03d}-{i}">{w[0]}</span>' for i, w in enumerate(g))
        html.append(f'    <div id="cap-{n:03d}" class="clip cap" data-start="{st}" data-duration="{round(en - st, 2)}"><div class="cap-inner">{spans}</div></div>')
        js.append(f'    tl.fromTo("#cap-{n:03d} .cap-inner", {{opacity: 0, y: 8}}, {{opacity: 1, y: 0, duration: 0.12, ease: "power2.out"}}, {st});')
        for i, w in enumerate(g): js.append(f'    tl.to("#cw-{n:03d}-{i}", {{color: "#E2AE2A", duration: 0.06, ease: "none"}}, {round(max(st, w[1]), 2)});')
        js.append(f'    tl.to("#cap-{n:03d} .cap-inner", {{opacity: 0, duration: 0.1, ease: "power2.in"}}, {round(en - 0.1, 2)});')
    (C / "captions.html").write_text(f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; font-family: Inter, sans-serif; }}
    .cap {{ position: absolute; left: 0; right: 0; top: 938px; text-align: center; overflow: visible; }}
    .cap-inner {{ display: inline-block; padding: 9px 24px; border-radius: 999px; background: rgba(28,27,25,.86); color: #FFFDF8; font-size: 38px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; opacity: 0; }}
    .w {{ display: inline-block; margin: 0 6px; }}
  </style>
  <div id="root" data-composition-id="captions" data-width="1920" data-height="1080">
{chr(10).join(html)}
  </div>
  <script>
  (function () {{
    const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
    window.__timelines["captions"] = tl;
  }})();
  </script>
</template>
""")
    return len(groups)

SFX = []   # (clip, scene id, offset, volume)
BUILDERS = {}

def main(only=None):
    import importlib
    s01(); s02(); s03()
    sys.path.insert(0, str(HERE / "src"))
    prod = importlib.import_module("product")
    amount = prod.build(sys.modules[__name__])
    ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]; tens = {2: "twenty", 3: "thirty", 4: "forty"}
    n = int(float(amount.strip("$"))); said = f"{tens.get(n // 10, '?')}-{ones[n % 10]}".rstrip("-")
    if said not in LINES["S04"].lower(): print(f"!! groceries in the footage are {amount} but S04 does not say '{said} dollars': set src/overrides.json and regenerate S04")
    else: print(f"S04 narration matches the footage: {amount} → '{said} dollars'")
    t_wall = s09(); s11()
    print("captions:", build_captions(), "groups")
    scenes.sort(key=lambda s: s.sid)
    SFX.extend([("sfx-footsteps", "S01", 0.3, 0.22), ("sfx-glitch", "S01", T("S01", "believe"), 0.3),
                ("sfx-coin", "S02", T("S02", "built") + 0.6, 0.3), ("sfx-door-slam", "S09", t_wall + 0.3, 0.4), ("sfx-coin", "S11", 0.3, 0.3)])
    hosts = "\n".join(
        f'      <div id="h-{s.cid}" data-composition-id="{s.cid}" data-composition-src="compositions/{s.cid}.html" data-start="{START[s.sid]}" data-duration="{DUR[s.sid]}" data-track-index="{i + 1}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>'
        for i, s in enumerate(scenes))
    audio = [f'      <audio id="vo" class="clip" data-start="0" data-duration="{TOTAL}" data-volume="1" data-track-index="20" src="assets/audio/vo.wav"></audio>']
    for i, (clip, sid, off, vol) in enumerate(sorted(SFX, key=lambda x: START[x[1]] + x[2])):
        d = round(dur_of(HERE / "assets/audio/sfx" / f"{clip}.mp3"), 2); at = round(START[sid] + off, 2)
        d = min(d, round(TOTAL - at - 0.05, 2))
        audio.append(f'      <audio id="sfx-{i:02d}" class="clip" data-start="{at}" data-duration="{d}" data-volume="{vol}" data-track-index="{21 + (i % 3)}" src="assets/audio/sfx/{clip}.mp3"></audio>')
    (HERE / "index.html").write_text(f'''<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Allowance — demo film v2</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: {PAPER}; }}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; }}
      #ground {{ position: absolute; inset: 0; background: {PAPER}; }}
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
''')
    # narration mix + timing
    (HERE / "assets/audio/timing.json").write_text(json.dumps({"total": TOTAL, "scenes": [
        {"id": s, "start": START[s], "dur": DUR[s], "vo_start": round(START[s] + LEAD, 2), "vo_dur": VO[s], "text": LINES[s]} for s in SIDS]}, indent=2))
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    for s in SIDS: cmd += ["-i", str(VO_DIR / f"{s}.mp3")]
    fc = "".join(f"[{i}]adelay={int((START[s] + LEAD) * 1000)}|{int((START[s] + LEAD) * 1000)}[a{i}];" for i, s in enumerate(SIDS))
    fc += "".join(f"[a{i}]" for i in range(len(SIDS))) + f"amix=inputs={len(SIDS)}:normalize=0:duration=longest,apad=whole_dur={TOTAL}[out]"
    subprocess.check_call(cmd + ["-filter_complex", fc, "-map", "[out]", "-ar", "44100", "-ac", "2", str(HERE / "assets/audio/vo.wav")])
    print(f"total {TOTAL}s ({int(TOTAL // 60)}:{TOTAL % 60:04.1f})")
    for s in SIDS: print(f"  {s} {START[s]:7.2f} → {START[s] + DUR[s]:7.2f}  ({DUR[s]}s)")

if __name__ == "__main__":
    main()
