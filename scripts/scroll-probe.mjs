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
    if (m.type() === "error") console.log(`[error] ${m.text()}`);
});

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForTimeout(1500);

const checkpoints = [
    { id: "hero", label: "01_hero" },
    { id: "problem", label: "02_problem", extraOffset: 1000 },
    { id: "how", label: "03_how", extraOffset: 1000 },
    { id: "compare", label: "04_compare", extraOffset: 1000 },
    { id: "vs", label: "05_vs", extraOffset: 1000 },
    { id: "sim", label: "06_sim", extraOffset: 1000 },
    { id: "network", label: "07_network", extraOffset: 1000 },
    { id: "cta", label: "08_cta" },
];

for (const cp of checkpoints) {
    const y = await page.evaluate((id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + window.scrollY : null;
    }, cp.id);

    if (y == null) {
        console.log(JSON.stringify({ id: cp.id, missing: true }));
        continue;
    }

    const scrollY = y + (cp.extraOffset ?? 0);
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(500);

    const probe = await page.evaluate((id) => {
        const sec = document.getElementById(id);
        if (!sec) return { id, missing: true };
        const firstOpacity = sec.querySelector('[style*="opacity"]');
        const allText = (sec.innerText || "").slice(0, 160).replace(/\s+/g, " ").trim();
        const rect = sec.getBoundingClientRect();
        return {
            id,
            height: Math.round(rect.height),
            topFromViewport: Math.round(rect.top),
            firstOpacityStyle: firstOpacity?.getAttribute("style")?.slice(0, 100) ?? null,
            firstOpacityComputed: firstOpacity ? Number.parseFloat(getComputedStyle(firstOpacity).opacity) : null,
            textPreview: allText,
            scrollY: window.scrollY,
        };
    }, cp.id);

    console.log(JSON.stringify(probe));
    await page.screenshot({ path: `${OUT}/${cp.label}.png`, fullPage: false });
}

await browser.close();
console.log("done");
