const { chromium } = require("playwright");
async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:4000/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Scroll to timeline, then deep into it to trigger delta
    await page.evaluate(() => document.getElementById("compare")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2.5));
    await page.waitForTimeout(800);
    await page.screenshot({ path: "screenshots/05b-timeline-delta.png", fullPage: false });

    await browser.close();
    console.log("Done");
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
