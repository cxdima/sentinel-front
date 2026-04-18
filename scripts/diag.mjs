import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:5179/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[console.error] ${m.text()}`);
});

const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForTimeout(1500);
console.log(`Ready +${Date.now() - t0}ms`);

// Scroll in 400px steps with heartbeat after each
for (let y = 0; y <= 24000; y += 400) {
    const scrollStart = Date.now();
    try {
        await Promise.race([
            page.evaluate((y) => window.scrollTo(0, y), y),
            new Promise((_, rej) => setTimeout(() => rej(new Error("scroll timeout")), 4000)),
        ]);
    } catch (e) {
        console.log(`\n*** HANG at y=${y} after ${Date.now() - scrollStart}ms ***`);
        break;
    }

    try {
        const sy = await Promise.race([
            page.evaluate(() => window.scrollY),
            new Promise((_, rej) => setTimeout(() => rej(new Error("t")), 2000)),
        ]);
        const dt = Date.now() - scrollStart;
        const marker = dt > 100 ? " SLOW" : "";
        console.log(`y=${y}  sy=${sy}  ${dt}ms${marker}`);
    } catch (e) {
        console.log(`\n*** HANG heartbeat at y=${y} ***`);
        break;
    }

    await page.waitForTimeout(100);
}

console.log(`\nErrors: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log(e);
await browser.close();
