import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:5179/";
const OUT = "scripts/_shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}] ${m.text()}`);
});

const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded" });
console.log(`DOM loaded at +${Date.now() - t0}ms`);

await page.waitForTimeout(1000);
console.log(`Waited 1s, taking shot 1`);
await page.screenshot({ path: `${OUT}/quick_01_load.png` });

// Jump directly to the how section and wait
await page.evaluate(() => {
    const el = document.getElementById("how");
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 800);
});
console.log(`jumped to #how at +${Date.now() - t0}ms`);

// Poll: is page still responsive?
for (let i = 0; i < 5; i++) {
    const ok = await page.evaluate(() => Date.now()).catch(() => null);
    console.log(`responsive-check ${i}: ${ok != null ? "yes" : "NO"} at +${Date.now() - t0}ms`);
    await page.waitForTimeout(500);
}

await page.screenshot({ path: `${OUT}/quick_02_how.png` });
console.log(`took shot 2`);

// Check how-section's inner state
const state = await page.evaluate(() => {
    const hs = document.querySelector("how-section");
    if (!hs) return { missing: true };
    const header = hs.querySelector("header");
    const firstCard = hs.querySelector('[style*="opacity"]');
    return {
        tagDisplay: getComputedStyle(hs).display,
        hostHeight: hs.getBoundingClientRect().height,
        headerStyle: header?.getAttribute("style"),
        cardStyle: firstCard?.getAttribute("style")?.slice(0, 200),
        cardOpacityComputed: firstCard ? Number.parseFloat(getComputedStyle(firstCard).opacity) : null,
    };
});
console.log("#how state:", JSON.stringify(state, null, 2));

await browser.close();
console.log("done");
