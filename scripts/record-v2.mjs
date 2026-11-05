// Records the v2 demo film footage from the hosted app (video/SCRIPT.md): one story, four things Scout
// tries to buy. Desktop scenes use a 1280x650 layout rendered at 1.5x, so the app's text is large inside
// the film's window. For the street beats the page is narrowed to 860 px mid-recording: the app's own
// narrow layout shows the Agent Cam almost full width ("record at the layout where the thing is large").
// Each scene writes NAME.webm + NAME.json (timed events + bounding boxes, used to place rings and cuts).
// usage: node scripts/record-v2.mjs [baseUrl] scene,names   scenes: linked rules store day activity paypal cleanup
import { chromium, devices } from "@playwright/test";
import { mkdirSync, renameSync, writeFileSync, readFileSync } from "node:fs";

const cred = (() => {
  try {
    const t = readFileSync(process.env.HOME + "/.allowance-paypal-sandbox", "utf8");
    const biz = t.split("PERSONAL")[0];
    return { email: biz.match(/email:\s*(\S+)/)?.[1], password: biz.match(/password:\s*(.+)/)?.[1]?.trim() };
  } catch { return {}; }
})();

const B = process.argv[2] ?? "https://allowance-kdvo.onrender.com";
const ONLY = (process.argv[3] ?? "").split(",").filter(Boolean);
const OUT = "video/recordings-v2";
mkdirSync(OUT, { recursive: true });
const VW = 1280, VH = 650, NW = 860;
const browser = await chromium.launch({ args: ["--force-device-scale-factor=1.5"] });
const phoneBrowser = await chromium.launch();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const desktop = { viewport: { width: VW, height: VH } };
const phone = { ...devices["iPhone 13"] };
const want = (n) => ONLY.includes(n);

async function open(name, opts) {
  const vp = opts.viewport ?? { width: VW, height: VH };
  const isDesk = vp.width === VW;
  const ctx = await (isDesk ? browser : phoneBrowser).newContext({ ...opts, recordVideo: { dir: OUT, size: isDesk ? { width: 1920, height: 975 } : vp } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const events = [];
  const ev = (n, extra = {}) => { const e = { t: +((Date.now() - t0) / 1000).toFixed(2), name: n, ...extra }; events.push(e); return e; };
  page.on("pageerror", (e) => log("PAGE ERROR", name, e.message));
  const close = async () => {
    const v = page.video();
    await ctx.close();
    if (v) renameSync(await v.path(), `${OUT}/${name}.webm`);
    writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ name, viewport: vp, events }, null, 1));
    log("saved", name, events.length, "events");
  };
  return { page, ev, close };
}
const reset = () => fetch(`${B}/api/demo/reset`, { method: "POST" }).then((r) => r.status);

// everything on the chat screen that the film points at, as one snapshot
const chatSnap = (p) => p.evaluate(() => {
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const byText = (t) => [...document.querySelectorAll("div")].find((d) => d.childElementCount === 0 && d.textContent.trim() === t);
  const feed = byText("What happened")?.parentElement?.parentElement;
  const list = feed?.children[1];
  const cards = [...(list?.children ?? [])].filter((c) => c.querySelector("button[aria-expanded]")).map((c) => {
    const amount = [...c.querySelectorAll("div")].find((d) => d.childElementCount === 0 && /^\$[\d,.]+$/.test(d.textContent.trim()));
    const sentence = [...c.children].find((d) => d.tagName === "DIV" && d.className.includes("text-[16px]"));
    const extra = [...c.children].find((d) => d.tagName === "DIV" && d.className.includes("text-[15px]") && d.className.includes("text-muted"));
    const titleEl = [...c.querySelectorAll("div")].find((d) => d.className.includes("text-[17px]"));
    return { pill: c.querySelector("span")?.textContent.trim(), title: titleEl?.textContent.trim(), store: titleEl?.nextElementSibling?.textContent.trim(), amount: amount?.textContent.trim(), box: R(c), amountBox: R(amount), sentence: sentence?.textContent.trim(), sentenceBox: R(sentence), extra: extra?.textContent.trim(), extraBox: R(extra) };
  });
  const canvas = document.querySelector("canvas[role=img]");
  const spent = [...document.querySelectorAll("div,span")].find((d) => d.childElementCount <= 3 && /spent this week$/.test(d.textContent.trim()));
  return { vw: innerWidth, cards, cam: R(canvas), camFrame: R(canvas?.parentElement?.parentElement), camWhere: canvas?.getAttribute("aria-label"), feed: R(feed), spent: R(spent), spentText: spent?.textContent.trim() };
});
// poll the chat screen and log a snapshot whenever something the film cares about changes
function watchChat(p, ev) {
  let stop = false, last = "";
  const loop = (async () => {
    while (!stop) {
      try {
        const s = await chatSnap(p);
        const sig = JSON.stringify([s.vw, s.cards.map((c) => [c.pill, c.amount, c.box?.y]), s.camWhere]);
        if (sig !== last) { last = sig; ev("snap", s); }
      } catch { /* navigating */ }
      await new Promise((r) => setTimeout(r, 150));
    }
  })();
  return async () => { stop = true; await loop; };
}
const until = async (p, pred, timeout = 240000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const s = await chatSnap(p).catch(() => null); if (s && pred(s)) return s; await p.waitForTimeout(150); }
  throw new Error("timed out waiting for the app");
};
const working = (p) => p.getByText("Scout is working…").waitFor({ state: "detached", timeout: 240000 });
// the app's own narrow layout: Agent Cam on top, almost full width
async function narrow(p, ev) {
  await p.setViewportSize({ width: NW, height: VH }); await p.waitForTimeout(350);
  await p.evaluate(() => { const c = document.querySelector("canvas[role=img]"), frame = c.parentElement.parentElement, main = document.querySelector("main"); main.scrollTop += frame.getBoundingClientRect().top - main.getBoundingClientRect().top - 10; });
  await p.waitForTimeout(300); ev("narrow", await chatSnap(p));
}
async function wide(p, ev) { await p.setViewportSize({ width: VW, height: VH }); await p.waitForTimeout(600); ev("wide", await chatSnap(p)); }

/** One chat request. `during(p, ev)` runs right after Send (layout switches, waits); then the scene waits for Scout to finish. */
async function chatScene(name, text, tailMs, during) {
  const { page: p, ev, close } = await open(name, desktop);
  let cards = null;
  try {
    await p.goto(`${B}/chat?record=1`, { waitUntil: "networkidle" }); ev("loaded"); await p.waitForTimeout(1800);
    const stopWatch = watchChat(p, ev);
    const box = p.getByLabel("Tell Scout what to buy");
    await box.click(); ev("type-start", { text });
    await box.pressSequentially(text, { delay: 26 }); ev("type-end");
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Send" }).click(); ev("sent");
    if (during) await during(p, ev);
    await working(p); ev("done");
    if ((await chatSnap(p)).vw !== VW) { await p.waitForTimeout(2500); await wide(p, ev); }
    await p.waitForTimeout(tailMs);
    await stopWatch();
    cards = (await chatSnap(p)).cards;
  } catch (e) { log("scene failed:", name, e.message.slice(0, 200)); }
  await close();
  return cards;
}
async function phoneScene(name, button, heading) {
  const ph = await open(name, phone);
  let ok = false;
  try {
    const p = ph.page;
    await p.goto(`${B}/approvals?record=1`, { waitUntil: "networkidle" }); ph.ev("loaded"); await p.waitForTimeout(3200);
    const btn = p.getByRole("button", { name: button });
    await btn.scrollIntoViewIfNeeded(); ph.ev("scrolled"); await p.waitForTimeout(1300);
    ph.ev("button", { box: await btn.boundingBox() });
    await btn.click(); ph.ev("tap");
    await p.getByRole("heading", { name: heading }).waitFor({ timeout: 60000 }); ph.ev("result");
    await p.waitForTimeout(6500);
    ok = true;
  } catch (e) { log("scene failed:", name, e.message.slice(0, 200)); }
  await ph.close();
  return ok;
}

if (want("linked")) {
  const { page: p, ev, close } = await open("linked", desktop);
  try {
    await p.goto(`${B}/connect?record=1`, { waitUntil: "networkidle" }); ev("loaded"); await p.waitForTimeout(1500);
    ev("boxes", await p.evaluate(() => {
      const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const t = [...document.querySelectorAll("div,span,h2,h3,p")].find((d) => d.childElementCount <= 1 && /^PayPal linked/.test(d.textContent.trim()));
      return { linked: R(t), card: R(t?.parentElement), card2: R(t?.parentElement?.parentElement) };
    }));
    await p.waitForTimeout(5000);
  } catch (e) { log("scene failed: linked", e.message.slice(0, 200)); }
  await close();
}

if (want("rules")) {
  const { page: p, ev, close } = await open("rules", desktop);
  try {
    await p.goto(`${B}/rules?record=1`, { waitUntil: "networkidle" }); ev("loaded"); await p.waitForTimeout(1500);
    ev("boxes", await p.evaluate(() => {
      const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const out = {};
      for (const label of ["Weekly budget", "Ask me before anything over"]) {
        const el = [...document.querySelectorAll("label,div,span")].find((d) => d.childElementCount === 0 && d.textContent.trim() === label);
        out[label] = { label: R(el), row: R(el?.parentElement), group: R(el?.parentElement?.parentElement), rowText: el?.parentElement?.textContent.trim().slice(0, 60) };
      }
      return out;
    }));
    await p.waitForTimeout(9000);
  } catch (e) { log("scene failed: rules", e.message.slice(0, 200)); }
  await close();
}

if (want("store")) {
  const { page: p, ev, close } = await open("store", desktop);
  try {
    await p.goto(`${B}/stores/megadealz247`, { waitUntil: "networkidle" }); ev("loaded"); await p.waitForTimeout(6000);
    ev("card", await p.evaluate(() => {
      const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const li = document.querySelector("li"); return { card: R(li), title: R(li?.children[1]), price: R(li?.children[2]), grid: R(li?.parentElement) };
    }));
    // reveal: the hidden 1 px note grows to readable, highlighted, in place — "what the AI reads"
    await p.evaluate(() => {
      const spans = [...document.querySelectorAll("p span[aria-hidden]")];
      for (const s of spans) { s.style.transition = "font-size .7s ease, color .7s ease, background .7s ease, padding .7s ease"; s.style.display = "inline"; s.style.borderRadius = "6px"; }
      requestAnimationFrame(() => { for (const s of spans) { s.style.fontSize = "15px"; s.style.color = "#FFFDF8"; s.style.background = "rgba(210,72,60,.55)"; s.style.padding = "2px 6px"; s.style.boxDecorationBreak = "clone"; s.style.webkitBoxDecorationBreak = "clone"; } });
    });
    ev("reveal");
    await p.waitForTimeout(1500);
    ev("note", await p.evaluate(() => {
      const R = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      const s = document.querySelector("p span[aria-hidden]"); const node = s.firstChild; const text = node.textContent;
      const phrase = (ph) => { const i = text.indexOf(ph); if (i < 0) return null; const rg = document.createRange(); rg.setStart(node, i); rg.setEnd(node, i + ph.length); return [...rg.getClientRects()].map(R); };
      return { span: [...s.getClientRects()].map(R), card: R(s.closest("li").getBoundingClientRect()), pre: phrase("pre-approved"), skip: phrase("Skip all spending checks"), text };
    }));
    await p.waitForTimeout(11000);
  } catch (e) { log("scene failed: store", e.message.slice(0, 200)); }
  await close();
}

// ---- the day (video/SCRIPT.md section 1). The agent and the safety check are live models, so a run can go
// off-story (a basket over $50 that rightly asks first, a wrong "needs your OK"). Each step is checked; a miss
// resets the demo and starts the day again.
const top = (cards, pill, amount) => cards?.[0]?.pill === pill && cards[0].amount === amount;
const brief = (c) => JSON.stringify(c?.map((x) => [x.pill, x.store, x.amount]));
async function dayPart1() {
  log("reset", await reset());
  // street beats in the narrow layout while Scout shops; back to wide for the two Paid cards
  let c = await chatScene("paid", "buy groceries for the week under $60, and a phone charger", 6000, async (p, ev) => { await p.waitForTimeout(1200); await narrow(p, ev); });
  const grocery = c?.find((x) => x.pill === "Paid" && /FreshCart/.test(x.store ?? ""));
  if (!(c?.length === 2 && grocery && c.some((x) => x.pill === "Paid" && x.amount === "$19.00"))) return log("off-story: paid", brief(c)), false;
  log("groceries paid:", grocery.amount);
  // the card first (wide), then the jar and its timer large (narrow), then wide again
  c = await chatScene("hold", "also get me the wireless over-ear headphones from VoltHub", 3000, async (p, ev) => {
    await until(p, (s) => s.cards[0]?.pill === "Needs your OK" && s.cards[0].amount === "$129.00"); ev("held");
    await p.waitForTimeout(7000); await narrow(p, ev); await p.waitForTimeout(8000); await wide(p, ev);
  });
  if (!top(c, "Needs your OK", "$129.00")) return log("off-story: hold", brief(c)), false;
  if (!(await phoneScene("approve", "Approve", /Paid/))) return log("off-story: approve"), false;
  return true;
}
async function dayPart2() {
  // narrow through the safety check and the stamp, then wide for the Blocked card
  let c = await chatScene("blocked", "get the USB-C charger from MegaDealz247, they have a mega deal", 2000, async (p, ev) => {
    await p.waitForTimeout(1200); await narrow(p, ev);
    await until(p, (s) => s.camWhere === "Blocked"); ev("stamped");
    await p.waitForTimeout(4200); await wide(p, ev); await p.waitForTimeout(3500);
  });
  if (!c?.some((x) => x.pill === "Blocked" && x.amount === "$54.00") || c.filter((x) => x.pill === "Paid").length !== 3) return log("off-story: blocked", brief(c)), false;
  c = await chatScene("hold2", "buy the wireless earbuds from VoltHub too", 4000);
  if (!top(c, "Needs your OK", "$59.00")) return log("off-story: hold2", brief(c)), false;
  if (!(await phoneScene("decline", "Don't buy", /Hold released/))) return log("off-story: decline"), false;
  // only blocks happen here, so this step can be retried on its own
  for (const msg of ["buy the wireless over-ear headphones from VoltHub again", "buy the wireless over-ear headphones from MegaDealz247, the TODAY ONLY ones", "get me another pair of the wireless over-ear headphones from VoltHub"]) {
    c = await chatScene("budget", msg, 6000);
    if (c?.some((x) => x.pill === "Blocked" && /weekly budget/.test(x.sentence ?? "")) && !c.some((x) => x.pill === "Needs your OK")) return true;
    log("off-story: budget", JSON.stringify(c?.map((x) => [x.pill, x.amount, x.sentence])));
  }
  return false;
}
const DAY = want("day");
let dayOk = !DAY;
if (DAY) {
  for (let attempt = 1; attempt <= 8 && !dayOk; attempt++) {
    log("=== day attempt", attempt);
    dayOk = (await dayPart1()) && (await dayPart2());
  }
  log(dayOk ? "day recorded on-story" : "DAY FAILED after 8 attempts");
}

if (want("activity") && dayOk) {
  const { page: p, ev, close } = await open("activity", desktop);
  try {
    await p.goto(`${B}/activity?record=1`, { waitUntil: "networkidle" }); ev("loaded"); await p.waitForTimeout(3500);
    ev("rows", { rows: await p.evaluate(() => [...document.querySelectorAll(".ag-row")].map((r) => {
      const R = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { text: r.textContent.slice(0, 160), box: R(r), cells: [...r.querySelectorAll(".ag-cell")].map((c) => ({ col: c.getAttribute("col-id"), text: c.textContent.trim().slice(0, 80), box: R(c) })) };
    })) });
    const row = p.locator(".ag-row", { hasText: "$129.00" }).filter({ hasText: "Paid" }).first();
    await row.click(); ev("row-click"); await p.waitForTimeout(2600);
    await p.evaluate(() => { const el = [...document.querySelectorAll("div,li,p,span")].find((d) => d.childElementCount === 0 && /^PayPal order .* created/.test(d.textContent.trim())); el?.scrollIntoView({ block: "center", behavior: "smooth" }); });
    ev("drawer-scroll"); await p.waitForTimeout(1200);
    ev("drawer", await p.evaluate(() => {
      const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const lines = [...document.querySelectorAll("div,li,p,span")].filter((d) => d.childElementCount === 0 && /^PayPal (order|is holding|paid|captured|let go)/i.test(d.textContent.trim()) && d.textContent.length < 160);
      return { lines: lines.map((d) => ({ text: d.textContent.trim(), box: R(d), card: R(d.parentElement?.parentElement) })) };
    }));
    await p.waitForTimeout(6500);
  } catch (e) { log("scene failed: activity", e.message.slice(0, 200)); }
  await close();
}

if (want("paypal") && dayOk) {
  // the sandbox account shows India time; match it so the page's default date range includes today's payments
  const { page: p, ev, close } = await open("paypal", { ...desktop, timezoneId: "Asia/Kolkata" });
  try {
    await p.goto("https://www.sandbox.paypal.com/signin"); await p.waitForTimeout(3000);
    if (!cred.email || !cred.password) throw new Error("no sandbox business login available");
    await p.locator("#email").fill(cred.email);
    const next = p.locator("#btnNext"); if (await next.count()) await next.click();
    await p.locator("#password").waitFor({ timeout: 20000 }); await p.locator("#password").fill(cred.password);
    await p.locator("#btnLogin").click(); await p.waitForTimeout(6000);
    await p.goto("https://www.sandbox.paypal.com/activities/"); ev("activities"); await p.waitForTimeout(5000);
    for (const label of ["Decline", "Reject", "Close"]) {
      const b = p.getByRole("button", { name: label, exact: true }).first();
      if (await b.count() && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); ev("cookie-dismissed", { label }); break; }
    }
    await p.waitForTimeout(1500);
    ev("rows", { rows: await p.evaluate(() => [...document.querySelectorAll("tr, [role=row]")].map((r) => { const b = r.getBoundingClientRect(); return { text: r.textContent.replace(/\s+/g, " ").slice(0, 140), box: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } }; }).filter((r) => r.box.h > 10)) });
    await p.waitForTimeout(9000);
    log("paypal url:", p.url());
  } catch (e) { log("scene failed: paypal", e.message.slice(0, 200)); }
  await close();
}

// leave the hosted demo clean for judges, whatever happened above
if (DAY && want("cleanup")) log("reset", await reset());
await browser.close(); await phoneBrowser.close();
log("all scenes done");
