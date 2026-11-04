// Records each demo scene from the hosted app at 1920×1080 (recording mode) with Playwright.
// usage: node scripts/record-scenes.mjs [baseUrl]   → video/recordings/*.webm
import { chromium, devices } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// PayPal sandbox BUSINESS login for the ledger scene: read from the private file, never committed.
const cred = (() => {
  try {
    const t = readFileSync(process.env.HOME + "/.allowance-paypal-sandbox", "utf8");
    const biz = t.split("PERSONAL")[0];
    return { email: biz.match(/email:\s*(\S+)/)?.[1], password: biz.match(/password:\s*(.+)/)?.[1]?.trim() };
  } catch { return { email: process.env.PAYPAL_SANDBOX_BUSINESS_EMAIL, password: process.env.PAYPAL_SANDBOX_BUSINESS_PASSWORD }; }
})();

const B = process.argv[2] ?? "https://allowance-kdvo.onrender.com";
const OUT = "video/recordings";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function scene(name, opts, fn) {
  const ctx = await browser.newContext({ ...opts, recordVideo: { dir: OUT, size: opts.viewport ?? { width: 1920, height: 1080 } } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log("PAGE ERROR", name, e.message));
  try { await fn(page, ctx); } catch (e) { log("scene failed:", name, e.message.slice(0, 160)); }
  const v = page.video();
  await ctx.close();
  if (v) { renameSync(await v.path(), `${OUT}/${name}.webm`); log("saved", name); }
}
const reset = () => fetch(`${B}/api/demo/reset`, { method: "POST" });
const desktop = { viewport: { width: 1920, height: 1080 } };
const phone = { ...devices["iPhone 13"] };
const working = (p) => p.getByText("Scout is working…").waitFor({ state: "detached", timeout: 240000 });
const send = async (p, text) => { await p.getByLabel("Tell Scout what to buy").fill(text); await p.getByRole("button", { name: "Send" }).click(); };

await reset();

// 01 — Link PayPal: button + Scout covering his eyes while the popup is open
await fetch(`${B}/api/paypal/vault/payment-token`, { method: "DELETE" });
await scene("01-connect-link", desktop, async (p, ctx) => {
  await p.goto(`${B}/connect?record=1`); await p.waitForTimeout(3000);
  const frame = p.frameLocator("#paypal-button iframe").first();
  await frame.locator("[data-funding-source='paypal']").first().waitFor({ timeout: 30000 });
  const [popup] = await Promise.all([ctx.waitForEvent("page"), frame.locator("[data-funding-source='paypal']").first().click()]);
  await p.waitForTimeout(3500);
  await popup.close(); await p.waitForTimeout(1500);
});
execSync("pnpm --silent tsx scripts/_relink-main.ts", { stdio: "inherit" });
await scene("02-connect-linked", desktop, async (p) => { await p.goto(`${B}/connect?record=1`); await p.waitForTimeout(4000); });

// 03 — Rules: sliders move, Scout reacts
await scene("03-rules", desktop, async (p) => {
  await p.goto(`${B}/rules?record=1`); await p.waitForTimeout(2500);
  const budget = p.getByLabel("Weekly budget"); await budget.focus();
  for (let i = 0; i < 10; i++) { await p.keyboard.press("ArrowRight"); await p.waitForTimeout(90); }
  await p.waitForTimeout(1200);
  const ask = p.getByLabel("Ask me before anything over"); await ask.focus();
  for (let i = 0; i < 6; i++) { await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(90); }
  await p.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { await p.keyboard.press("ArrowRight"); await p.waitForTimeout(90); }
  await budget.focus(); for (let i = 0; i < 10; i++) { await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(60); }
  await p.waitForTimeout(2000);
});

// 04–10 — Shop with Scout: paid → hold → phone approve → blocked → second hold → phone decline → budget
await reset();
await scene("04-shop-paid", desktop, async (p) => {
  await p.goto(`${B}/chat?record=1`); await p.waitForTimeout(2000);
  await p.getByRole("button", { name: /buy groceries for the week/i }).click(); await p.waitForTimeout(800);
  await p.getByRole("button", { name: "Send" }).click();
  await working(p); await p.waitForTimeout(9000);
});
await scene("05-shop-hold", desktop, async (p) => {
  await p.goto(`${B}/chat?record=1`); await p.waitForTimeout(1500);
  await send(p, "also get me the wireless over-ear headphones from VoltHub");
  await working(p); await p.waitForTimeout(6000);
});
await scene("06-phone-approve", phone, async (p) => {
  await p.goto(`${B}/approvals?record=1`); await p.waitForTimeout(3500);
  await p.getByRole("button", { name: "Approve" }).click();
  await p.getByRole("heading", { name: /Paid/ }).waitFor({ timeout: 60000 }); await p.waitForTimeout(6000);
});
await scene("07-shop-blocked", desktop, async (p) => {
  await p.goto(`${B}/chat?record=1`); await p.waitForTimeout(1500);
  await send(p, "get the USB-C charger from MegaDealz247, they have a mega deal");
  await working(p); await p.waitForTimeout(5000);
});
await scene("08-shop-second-hold", desktop, async (p) => {
  await p.goto(`${B}/chat?record=1`); await p.waitForTimeout(1500);
  await send(p, "buy the wireless earbuds from VoltHub too");
  await working(p); await p.waitForTimeout(3000);
});
await scene("09-phone-decline", phone, async (p) => {
  await p.goto(`${B}/approvals?record=1`); await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Don't buy" }).click();
  await p.getByRole("heading", { name: /Hold released/ }).waitFor({ timeout: 60000 }); await p.waitForTimeout(5000);
});
await scene("10-shop-budget", desktop, async (p) => {
  await p.goto(`${B}/chat?record=1`); await p.waitForTimeout(1500);
  await send(p, "buy the wireless over-ear headphones from MegaDealz247, the TODAY ONLY ones");
  await working(p); await p.waitForTimeout(4000);
});

// 11 — Plain view · 12 — Activity with the story drawer
await scene("11-plain-view", desktop, async (p) => {
  await p.goto(`${B}/chat?record=1`); await p.waitForTimeout(2000);
  await p.evaluate(() => localStorage.setItem("allowance:plain", "1")); await p.reload(); await p.waitForTimeout(5000);
  await p.evaluate(() => localStorage.setItem("allowance:plain", "0"));
});
await scene("12-activity", desktop, async (p) => {
  await p.goto(`${B}/activity?record=1`); await p.waitForTimeout(3000);
  await p.locator(".ag-row").nth(2).click(); await p.waitForTimeout(5000);
  await p.keyboard.press("Escape"); await p.waitForTimeout(1500);
});

// 13 — PayPal sandbox: the business account's activity (best effort; PayPal may block automation)
await scene("13-paypal-sandbox", desktop, async (p) => {
  await p.goto("https://www.sandbox.paypal.com/signin"); await p.waitForTimeout(3000);
  if (!cred.email || !cred.password) throw new Error("no sandbox business login available");
  await p.locator("#email").fill(cred.email);
  const next = p.locator("#btnNext"); if (await next.count()) await next.click();
  await p.locator("#password").waitFor({ timeout: 20000 }); await p.locator("#password").fill(cred.password);
  await p.locator("#btnLogin").click(); await p.waitForTimeout(6000);
  await p.goto("https://www.sandbox.paypal.com/activities/"); await p.waitForTimeout(6000);
  log("paypal url:", p.url());
});

await reset();
await browser.close();
log("all scenes done");
