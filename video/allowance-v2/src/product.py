"""Product scenes S04–S08 and S10: real recordings of the app in the window, cut and ringed from the
events the recorder logged (video/recordings-v2/*.json). Desktop event times equal video times (checked by
frame); the phone clips start late, so their offset is measured from the footage. Street beats use the
footage recorded in the app's narrow layout, where the Agent Cam is almost full width."""
import re, subprocess

def build(B):
    Scene, T, rec, ev, scenes, SFX, K, WIN, INK, HERE = B.Scene, B.T, B.rec, B.ev, B.scenes, B.SFX, B.K, B.WIN, B.INK, B.HERE
    snaps = lambda E: [e for e in E if e["name"] in ("snap", "narrow", "wide")]
    def snap_at(E, t):
        out = None
        for e in snaps(E):
            if e["t"] <= t + 0.01: out = e
        return out or snaps(E)[0]
    def card_time(E, pred):
        for e in snaps(E):
            for c in e["cards"]:
                if pred(c): return e["t"]
        raise SystemExit("card not found")
    def card_in(snap, pred):
        for c in snap["cards"]:
            if pred(c): return c
        raise SystemExit("card not in snapshot")
    def where_time(E, label, after=0):
        for e in snaps(E):
            if e["t"] >= after and e["camWhere"] == label: return e["t"]
        raise SystemExit(f"cam label {label!r} not found")
    def T_any(sid, *tokens):
        for tok in tokens:
            try: return T(sid, tok)
            except SystemExit: pass
        raise SystemExit(f"none of {tokens} spoken in {sid}")
    def phone_off(name, E):
        """Seconds the phone video lags its event clock: match the scroll→tap gap to two scene changes."""
        out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(HERE / f"assets/video/{name}.mp4"), "-vf", "select='gt(scene,0.02)',showinfo", "-f", "null", "-"], capture_output=True, text=True).stderr
        sc = [float(x) for x in re.findall(r"pts_time:([0-9.]+)", out)]
        scrolled, tap = ev(E, "scrolled")["t"], ev(E, "tap")["t"]
        best = None
        for i in range(len(sc)):
            for j in range(i + 1, len(sc)):
                err = abs((sc[j] - sc[i]) - (tap - scrolled))
                if err < 0.3 and (best is None or err < best[0]): best = (err, scrolled - sc[i])
        off = round(best[1], 2) if best else 0.0
        print(f"  phone clip {name}: video lags events by {off}s")
        return off
    def narrow_from(E):
        """Second at which the recording starts to change to the narrow layout (a little before it settles)."""
        return next(e["t"] for e in snaps(E) if e["vw"] != 1280) - 0.35
    PH = dict(x=1290, y=160, sw=420, k=420 / 390)        # phone frame position and screen scale

    def phone(s, clips, at_in, at_out=None):
        vids = "".join(f'<video id="{s.p}-pv{i}" class="clip" data-start="{round(st, 2)}" data-duration="{round(du, 2)}" data-media-start="{round(ms, 2)}" muted playsinline src="assets/video/{f}.mp4" style="z-index:{i + 1}"></video>' for i, (f, st, du, ms) in enumerate(clips))
        s.add(f'<div id="{s.p}-ph" class="phone" data-layout-ignore style="left:{PH["x"]}px;top:{PH["y"]}px;width:{PH["sw"] + 20}px;height:{round(664 * PH["k"]) + 20}px"><div class="scr">{vids}</div></div>')
        s.css += f'\n    #{s.p}-ph video {{ width: {PH["sw"]}px; height: {round(664 * PH["k"])}px; object-fit: fill; }}'
        s.tw(f'tl.fromTo("#{s.p}-ph", {{opacity: 0, x: 140, rotation: 5}}, {{opacity: 1, x: 0, rotation: 0, duration: 0.6, ease: "expo.out"}}, {round(at_in, 2)});')
        if at_out is not None: s.tw(f'tl.to("#{s.p}-ph", {{opacity: 0, x: 140, duration: 0.4, ease: "power3.in"}}, {round(at_out, 2)});')
    def phone_tap(s, box, t):
        cx = PH["x"] + 10 + (box["x"] + box["width"] / 2) * PH["k"]; cy = PH["y"] + 10 + (box["y"] + box["height"] / 2) * PH["k"]
        s.tap(round(cx), round(cy), round(box["width"] * PH["k"]), round(box["height"] * PH["k"]), round(t, 2))
    clipbox = lambda b: dict(x=b["x"], y=b["y"], w=b["w"], h=min(b["h"], 642 - b["y"]))

    # ------------------------------------------------------------ S04 small stuff
    s = Scene("S04"); E = rec("paid"); D = s.dur
    ts, tn, W = ev(E, "type-start")["t"], ev(E, "narrow")["t"], ev(E, "wide")
    paid = lambda c: c["pill"] == "Paid"
    t1 = card_time(E, paid); first = card_in(snap_at(E, t1), paid)
    t2 = card_time(E, lambda c: paid(c) and c["amount"] != first["amount"])
    second = card_in(snap_at(E, t2), lambda c: paid(c) and c["amount"] != first["amount"])
    tp1 = where_time(E, f'Paid at {first["store"]}', t1 - 0.5); tp2 = where_time(E, f'Paid at {second["store"]}', t2 - 0.5)
    t_g = round(T("S04", "away", end=True) + 0.2, 2); t_c = T_any("S04", "$19", "19", "nineteen")
    cut_b = round(T("S04", "watch") - 0.15, 2); cut_c = round(t_g - 0.5, 2); cut_b2 = round(cut_c - 1.9, 2)
    m_b = tp1 + 1.9 - (cut_b2 - cut_b)
    s.window([("paid", 0, cut_b, min(ts - 0.3, narrow_from(E) - cut_b)), ("paid", cut_b, cut_b2 - cut_b, m_b), ("paid", cut_b2, cut_c - cut_b2, tp2 - 0.4), ("paid", cut_c, D - cut_c, W["t"] + 0.4)])
    s.narrow(cut_b); s.wide(cut_c)
    s.chrome(chapter=("01", "SMALL STUFF"))
    s.sped(cut_b - 0.1, 1.4, narrow=True); s.sped(cut_b2 - 0.1, 1.1, narrow=True)
    s.super("Inside your rules → <b>paid</b>", T("S04", "both"))
    groc = card_in(W, lambda c: paid(c) and c["store"] == "FreshCart"); chg = card_in(W, lambda c: paid(c) and c["store"] == "VoltHub")
    s.ring(clipbox(groc["box"]), t_g, t_c - 0.05, pad=3, radius=18)
    s.ring(clipbox(chg["box"]), t_c, T("S04", "I", 2) + 0.2, pad=3, radius=18)
    SFX.extend([("sfx-coin", "S04", cut_b + (tp1 - 1.0 - m_b), 0.3), ("sfx-receipt", "S04", cut_b + (tp1 - m_b), 0.28), ("sfx-receipt", "S04", cut_b2 + 0.4, 0.28)])
    scenes.append(s.write())
    S04_AMOUNT = groc["amount"]

    # ------------------------------------------------------------ S05 asks first
    s = Scene("S05"); E = rec("hold"); A = rec("approve"); D = s.dur
    ts, th, N, W = ev(E, "type-start")["t"], ev(E, "held")["t"], ev(E, "narrow"), ev(E, "wide")
    is_hold = lambda c: c["pill"] == "Needs your OK" and c["amount"] == "$129.00"
    cut_b = round(T("S05", "$129") - 0.35, 2); t_nar = round(T("S05", "penny") - 0.35, 2); t_phone = round(T("S05", "question") - 0.35, 2); t_wide = round(t_phone - 0.2, 2)
    rate_b = round(min(1.0, (narrow_from(E) - (th - 0.3)) / (t_nar - cut_b)), 3)
    s.window([("hold", 0, cut_b, ts - 0.2), ("hold", cut_b, t_nar - cut_b, th - 0.3, rate_b), ("hold", t_nar, t_wide - t_nar, N["t"] + 0.4), ("hold", t_wide, D - t_wide, W["t"] + 0.4)])
    s.narrow(t_nar); s.wide(t_wide)
    s.chrome(chapter=("02", "ASKS FIRST"))
    s.sped(cut_b - 0.1, 1.3)
    s.super("Over your limit → <b>it asks first</b>", T("S05", "that's"))
    card = card_in(snap_at(E, th + 2), is_hold)
    s.ring(card["amountBox"], T("S05", "$129") + 0.15, T("S05", "over") - 0.1, pad=7)
    s.ring(card["sentenceBox"], T("S05", "over") + 0.05, t_nar - 0.05, pad=7)
    cam = N["cam"]
    jar = dict(x=cam["x"] + 101 / 192 * cam["w"], y=cam["y"] + 41 / 108 * cam["h"], w=22 / 192 * cam["w"], h=27 / 108 * cam["h"])
    s.ring(jar, T("S05", "10") - 0.15, t_wide - 0.05, pad=8, radius=18)
    off = phone_off("approve", A)
    t_tap = round(T("S05", "tap") + 0.35, 2)
    tapV, resV, btn = ev(A, "tap")["t"] - off, ev(A, "result")["t"] - off, ev(A, "button")["box"]
    p1_end = round(t_tap + 0.6, 2)
    phone(s, [("approve", t_phone, p1_end - t_phone, tapV - (t_tap - t_phone)), ("approve", p1_end, D - p1_end, resV - 0.3)], t_phone)
    phone_tap(s, btn, t_tap)
    SFX.extend([("sfx-jar", "S05", cut_b + 0.3 + 0.8, 0.3), ("sfx-coin-rain", "S05", p1_end + 0.4, 0.3)])
    scenes.append(s.write())

    # ------------------------------------------------------------ S06 the trap
    s = Scene("S06"); E = rec("store"); D = s.dur
    t_rev = ev(E, "reveal")["t"]; note = ev(E, "note"); loaded = ev(E, "loaded")["t"]
    t_tag = round(T("S06", "way") - 0.1, 2); t_reveal = round(T("S06", "AI") + 0.15, 2)
    pre_span = (t_rev - 0.25) - (loaded + 0.6)
    s.window([("store", 0, t_reveal - 0.2, loaded + 0.6, round(pre_span / (t_reveal - 0.2), 3)), ("store", t_reveal - 0.2, D - t_reveal + 0.2, t_rev - 0.2)])
    s.chrome(chapter=("03", "THE TRAP"))
    s.push((640, 0), 1.2, T("S06", "looks") - 0.2, 1.2)         # top-aligned: header, banner and the three products, nothing cut
    s.push((640, 400), 1.25, t_reveal - 0.1, 1.0)               # down to the product text as the note appears (banner fully out)
    for rects, tok in ((note["pre"], "pre*"), (note["skip"], "skip")):
        t_in = T("S06", tok) - 0.05; t_out = D - 0.2 if tok == "skip" else T("S06", "skip") - 0.1
        for r in rects: s.ring(r, t_in, t_out, pad=2, radius=7)
    top = "position:absolute;left:0;right:0;top:66px;text-align:center;z-index:20;opacity:0"
    s.add(f'<div id="s06-msg" style="{top}"><span style="display:inline-block;border-radius:24px 24px 6px 24px;background:{INK};color:#FFFDF8;padding:14px 26px;font:400 30px/1.3 Inter,sans-serif">get the USB-C charger from MegaDealz247, they have a mega deal</span></div>')
    s.tw(f'tl.fromTo("#s06-msg", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.4, ease: "expo.out"}}, {round(T("S06", "send") - 0.25, 2)});')
    s.tw(f'tl.to("#s06-msg", {{opacity: 0, duration: 0.3}}, {round(T("S06", "but") + 0.6, 2)});')
    s.add(f'<div id="s06-tag" style="{top}"><span style="display:inline-block;padding:13px 30px;border-radius:999px;background:#E2AE2A;color:{INK};font:600 36px Inter,sans-serif">What the AI reads on this page</span></div>')
    s.tw(f'tl.fromTo("#s06-tag", {{opacity: 0, y: -12}}, {{opacity: 1, y: 0, duration: 0.3, ease: "expo.out"}}, {t_tag});')
    SFX.append(("sfx-glitch", "S06", t_reveal, 0.3))
    scenes.append(s.write())

    # ------------------------------------------------------------ S07 blocked
    s = Scene("S07"); E = rec("blocked"); D = s.dur
    is_blk = lambda c: c["pill"] == "Blocked" and c["amount"] == "$54.00"
    t0 = card_time(E, is_blk)                      # the decision lands: the street's safety-check scene starts
    W = ev(E, "wide")
    tsc = where_time(E, "Safety check", t0 - 0.2)  # x-ray starts; banners at +0.67 and +0.87, door shakes +1.8, stamp +2.1 to +2.4
    a = round(T("S07", "noticed") - 0.3, 2)        # x-ray starts under "She also noticed"
    b = round(a + 1.35, 2)                         # first banner is up; slow right down until the second is named
    c_ = round(T("S07", "store") - 0.1, 2)
    slam = round(T("S07", "shuts") - 0.05, 2)      # the door shakes on "shuts"; the stamp lands on "Blocked"
    r4 = round(0.9 / (slam - c_), 3)
    t_card = T("S07", "nothing"); cut_w = round(t_card - 0.15, 2)
    t_street = round(T("S07", "she") - 0.2, 2)    # "She reads the page too": leave the note, go to the street
    St = rec("store")
    s.window([("store", 0, t_street, ev(St, "note")["t"] + 1.5, 0.3), ("blocked", t_street, a - t_street, tsc - 0.6 - (a - t_street)), ("blocked", a, b - a, tsc - 0.6),
              ("blocked", b, c_ - b, tsc + 0.75, round(0.15 / (c_ - b), 3)), ("blocked", c_, slam - c_, tsc + 0.9, r4), ("blocked", slam, cut_w - slam, tsc + 1.8, 0.8),
              ("blocked", cut_w, D - cut_w, W["t"] + 0.4)])
    s.cam_set(0, (640, 400), 1.25); s.cam_set(t_street); s.narrow(t_street); s.wide(cut_w)
    s.add(f'<div id="s07-tag" style="position:absolute;left:0;right:0;top:66px;text-align:center;z-index:20"><span style="display:inline-block;padding:13px 30px;border-radius:999px;background:#E2AE2A;color:{INK};font:600 36px Inter,sans-serif">What the AI reads on this page</span></div>')
    s.tw(f'tl.to("#s07-tag", {{opacity: 0, duration: 0.25}}, {round(t_street - 0.3, 2)});')
    s.chrome(chapter=("04", "BLOCKED"))
    card = card_in(snap_at(E, W["t"] + 1.0), is_blk)
    s.super("Blocked. <b>Nothing was charged.</b>", T("S07", "blocked") + 0.1)
    s.ring(card["sentenceBox"], t_card + 0.15, D - 0.2, pad=7)
    SFX.extend([("sfx-glitch", "S07", a + 0.6, 0.25), ("sfx-door-slam", "S07", slam + 0.05, 0.4), ("sfx-stamp", "S07", round(slam + 0.4, 2), 0.4)])
    scenes.append(s.write())

    # ------------------------------------------------------------ S08 your call
    s = Scene("S08"); E = rec("hold2"); Dc = rec("decline"); G = rec("budget"); D = s.dur
    is59 = lambda c: c["pill"] == "Needs your OK" and c["amount"] == "$59.00"
    t59 = card_time(E, is59)
    is_bud = lambda c: c["pill"] == "Blocked" and "weekly budget" in (c.get("sentence") or "")
    tb = card_time(G, is_bud)
    cut = round(T("S08", "and", 3) - 0.3, 2)       # "And when a purchase would go past…"
    s.window([("hold2", 0, cut, t59 + 0.9), ("budget", cut, D - cut, tb - 0.35)])
    s.chrome(chapter=("05", "YOUR CALL"))
    s.super("Say no → <b>the hold is released</b>", T("S08", "no") + 0.2, cut - 0.1)
    off = phone_off("decline", Dc)
    t_tap = round(T("S08", "tap") + 0.45, 2); t_phone = 0.5
    tapV, btn = ev(Dc, "tap")["t"] - off, ev(Dc, "button")["box"]
    phone(s, [("decline", t_phone, cut - t_phone + 0.3, tapV - (t_tap - t_phone))], t_phone, cut - 0.25)
    phone_tap(s, btn, t_tap)
    gs = snap_at(G, tb + 1)
    s.ring(gs["spent"], T("S08", "past") - 0.1, T("S08", "scout", 2) - 0.1, pad=6)
    s.ring(card_in(gs, is_bud)["sentenceBox"], T("S08", "budget") - 0.1, D - 0.2, pad=7)
    SFX.append(("sfx-stamp", "S08", round(cut + 0.35 + 2.7 - 0.15, 2), 0.35))
    scenes.append(s.write())

    # ------------------------------------------------------------ S10 receipts
    s = Scene("S10"); E = rec("activity"); P = rec("paypal"); D = s.dur
    loaded, t_rc, drawer = ev(E, "loaded")["t"], ev(E, "row-click")["t"], ev(E, "drawer")
    cut_d = round(T("S10", "PayPal") + 0.1, 2)     # drawer open on "the PayPal reference"
    cut_p = round(T("S10", "here") - 0.15, 2)      # PayPal's own page
    a_span = (t_rc - 0.1) - (loaded + 1.4)
    s.window([("activity", 0, cut_d, loaded + 1.4, round(a_span / cut_d, 3)), ("activity", cut_d, cut_p - cut_d, drawer["t"] + 0.15, 0.3),
              ("paypal", cut_p, D - cut_p, ev(P, "rows")["t"] + 0.2, 0.5)], enter=0.1)
    s.chrome(chapter=("07", "RECEIPTS"))
    reason = None
    for want in ("Price is", "is over your", "more than"):
        for r in ev(E, "rows")["rows"]:
            for cl in r["cells"]:
                if want in cl["text"] and cl["box"]["w"] > 150: reason = reason or cl["box"]
    if reason: s.ring(dict(x=reason["x"], y=reason["y"], w=min(reason["w"], 1262 - reason["x"]), h=reason["h"]), T("S10", "reason") - 0.1, cut_d - 0.05, pad=2, radius=10)
    else: print("  !! S10: no Reason cell found to ring")
    ref = [l for l in drawer["lines"] if l["text"].startswith("PayPal order") and 60 < l["box"]["y"] < 600]
    if ref: s.ring(ref[-1]["box"], cut_d + 0.25, cut_p - 0.05, pad=8)
    else: print("  !! S10: PayPal reference line is not in view in the drawer")
    s.super("Same payments, <b>inside PayPal</b>", cut_p + 0.2)
    prow = ev(P, "rows")["rows"]
    find = lambda key: next((r["box"] for r in prow if key in r["text"]), None)
    inset = lambda bx: dict(x=bx["x"] + 8, y=bx["y"] + 5, w=bx["w"] - 16, h=bx["h"] - 10)
    for key, t_in, t_out in (("Completed$129.00", T("S10", "paid") - 0.05, T("S10", "paid", 2) - 0.1),
                             ("Completed$19.00", T("S10", "paid", 2) - 0.05, T("S10", "and", 3) - 0.1),
                             ("Voided$59.00", T("S10", "one", 2) - 0.05, D - 0.2)):
        bx = find(key)
        if bx and bx["y"] + bx["h"] <= 655: s.ring(inset(bx), t_in, t_out, pad=0, radius=12)
        else: print(f"  !! S10: PayPal row {key} not in view")
    scenes.append(s.write())
    return S04_AMOUNT
