import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
page.on("console", (m) => {
    if (m.type() !== "debug") console.log(`[${m.type()}] ${m.text()}`);
});

await page.goto(process.env.URL ?? "http://localhost:5179/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Simulate user scrolling incrementally via mouse wheel
for (let y = 0; y <= 10000; y += 100) {
    try {
        await Promise.race([
            page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y),
            new Promise((_, rej) => setTimeout(() => rej(new Error("t")), 2000)),
        ]);
        await page.waitForTimeout(30);
    } catch (e) {
        console.log(`*** HANG at y=${y} ***`);
        break;
    }
}
await browser.close();
