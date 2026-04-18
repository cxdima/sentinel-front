import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:5179/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleMsgs = [];
page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const report = await page.evaluate(() => {
    const tags = [
        "hero-section",
        "blur-overlay",
        "scrolly-section",
        "how-section",
        "timeline-compare",
        "compare-table",
        "trust-sim",
        "immunity-map",
        "cta-section",
        "marquee-ticker",
        "site-footer",
        "webgl-bg",
        "nav-bar",
    ];
    return tags.map((tag) => {
        const el = document.querySelector(tag);
        if (!el) return { tag, missing: true };
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
            tag,
            display: cs.display,
            position: cs.position,
            width: Math.round(r.width),
            height: Math.round(r.height),
            top: Math.round(r.top),
            children: el.childElementCount,
        };
    });
});

console.log(JSON.stringify(report, null, 2));
console.log("--- CONSOLE ---");
for (const m of consoleMsgs) console.log(m);

// Scroll through and take screenshots at key checkpoints
const sections = await page.evaluate(() =>
    ["#hero", "#problem", "#how", "#compare", "#vs", "#sim", "#network", "#cta"].map((id) => {
        const el = document.querySelector(id);
        return el
            ? { id, top: el.getBoundingClientRect().top + window.scrollY, height: el.offsetHeight }
            : { id, missing: true };
    }),
);
console.log("--- SECTIONS ---");
console.log(JSON.stringify(sections, null, 2));

await browser.close();
