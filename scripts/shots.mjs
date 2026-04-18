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

const checkpoints = [
    { y: 0, label: "01_hero" },
    { y: 2500, label: "02_problem_mid" },
    { y: 6000, label: "03_how_mid" },
    { y: 9500, label: "04_compare_mid" },
    { y: 13500, label: "05_vs_mid" },
    { y: 16800, label: "06_sim_mid" },
    { y: 20500, label: "07_network_mid" },
    { y: 23000, label: "08_cta" },
];

for (const cp of checkpoints) {
    try {
        await Promise.race([
            page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), cp.y),
            new Promise((_, rej) => setTimeout(() => rej(new Error("scroll timeout")), 3000)),
        ]);
        await page.waitForTimeout(600);
        const sy = await Promise.race([
            page.evaluate(() => window.scrollY),
            new Promise((_, rej) => setTimeout(() => rej(new Error("heartbeat timeout")), 2000)),
        ]);
        await page.screenshot({ path: `${OUT}/${cp.label}.png` });
        console.log(`${cp.label}: commanded=${cp.y} actual=${sy}`);
    } catch (e) {
        console.log(`${cp.label}: FAILED ${e.message}`);
        try {
            await page.screenshot({ path: `${OUT}/${cp.label}_FAIL.png` });
        } catch {}
        break;
    }
}

await browser.close();
