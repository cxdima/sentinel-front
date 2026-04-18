import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(process.env.URL ?? "http://localhost:5179/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const layout = await page.evaluate(() => {
    const ids = ["hero", "problem", "how", "compare", "vs", "sim", "network", "cta"];
    return ids
        .map((id) => {
            const el = document.getElementById(id);
            if (!el) return { id, missing: true };
            const r = el.getBoundingClientRect();
            return { id, top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
        })
        .concat([{ id: "TOTAL", top: 0, height: document.documentElement.scrollHeight }]);
});
console.log(JSON.stringify(layout, null, 2));
await browser.close();
