// Drives the real UI and saves screenshots at the design sizes.
// usage: node scripts/screenshots.mjs <outDir> [baseUrl]
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "screenshots";
const base = process.argv[3] ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", name);
}

// --- chat: run a real task through the UI ---
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`${base}/chat`);
  await shot(page, "chat-1440-initial");
  const suggestion = page.getByRole("button", { name: /buy groceries for the week/i });
  if (await suggestion.count()) await suggestion.click();
  else await page.getByLabel("Tell Scout what to buy").fill("Buy groceries for the week under $60, and a phone charger.");
  await page.getByRole("button", { name: "Send" }).click();
  // first decision card shows up → catch the cam mid-scene
  await page.locator("article").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, "chat-1440-mid-run");
  await page.getByText("Scout is working…").waitFor({ state: "detached", timeout: 180000 });
  await shot(page, "chat-1440-done");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await shot(page, "chat-1920-done");
  await page.getByRole("switch", { name: /plain view/i }).click();
  await shot(page, "chat-1920-plain");
  await page.getByRole("button", { name: "Details" }).first().click();
  await shot(page, "chat-1920-details");
  await ctx.close();
}

// --- approvals desktop ---
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`${base}/approvals`);
  await page.waitForTimeout(1500);
  await shot(page, "approvals-1440");
  await ctx.close();
}

// --- approvals phone: approve one, decline one ---
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`${base}/approvals`);
  await page.waitForTimeout(1500);
  await shot(page, "approvals-phone");
  const details = page.getByRole("button", { name: "Details" });
  if (await details.count()) { await details.click(); await shot(page, "approvals-phone-details"); }
  const approve = page.getByRole("button", { name: "Approve" });
  if (await approve.count()) {
    await approve.click();
    await page.getByText("Paid").first().waitFor({ timeout: 30000 });
    await shot(page, "approvals-phone-paid");
    await page.getByRole("button", { name: "Back to Scout" }).click();
    await page.waitForTimeout(1200);
    const deny = page.getByRole("button", { name: "Don't buy" });
    if (await deny.count()) {
      await deny.click();
      await page.getByText("Hold released").first().waitFor({ timeout: 30000 });
      await shot(page, "approvals-phone-released");
      await page.getByRole("button", { name: "Back to Scout" }).click();
      await page.waitForTimeout(1200);
      await shot(page, "approvals-phone-empty");
    }
  }
  await ctx.close();
}

// --- chat after approvals: feed shows paid + not bought ---
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/chat`);
  await page.waitForTimeout(1500);
  await shot(page, "chat-1440-after-approvals");
  await ctx.close();
}
await browser.close();
