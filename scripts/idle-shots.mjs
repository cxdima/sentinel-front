import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:5179/";
const OUT = "scripts/_shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForTimeout(1500);

// Scroll to trust-sim, wait for idle, screenshot
for (const [y, label] of [
    [16800, "idle_05_sim"],
    [20500, "idle_06_net"],
    [6000, "idle_02_how"],
    [9500, "idle_03_compare"],
]) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(2200); // past IDLE_DELAY_MS (1400)
    await page.screenshot({ path: `${OUT}/${label}.png` });
    console.log(`${label}: done`);
}

await browser.close();
