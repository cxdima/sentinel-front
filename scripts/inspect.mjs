import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}] ${m.text()}`);
});

await page.goto(process.env.URL ?? "http://localhost:5179/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

for (const y of [5400, 5600, 5800, 6000]) {
    const start = Date.now();
    try {
        await Promise.race([
            page.evaluate((y) => window.scrollTo(0, y), y),
            new Promise((_, rej) => setTimeout(() => rej(new Error("t")), 4000)),
        ]);
        const state = await Promise.race([
            page.evaluate(() => {
                const cards = document.querySelectorAll("feature-card");
                const svgs = document.querySelectorAll("feature-card svg");
                const animateTransforms = document.querySelectorAll("animateTransform");
                return {
                    cards: cards.length,
                    svgs: svgs.length,
                    animateTransforms: animateTransforms.length,
                    total: document.querySelectorAll("*").length,
                };
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error("h")), 2000)),
        ]);
        console.log(`y=${y} ${Date.now() - start}ms`, JSON.stringify(state));
    } catch (e) {
        console.log(`y=${y} FAILED (${e.message}) after ${Date.now() - start}ms`);
        break;
    }
    await page.waitForTimeout(300);
}
await browser.close();
