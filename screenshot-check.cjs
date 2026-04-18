const { chromium } = require("playwright");

async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:4000/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // 1. Hero
    await page.screenshot({ path: "screenshots/01-hero.png", fullPage: false });

    // 2. Scroll to problem/scrolly
    await page.evaluate(() => document.getElementById("problem")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshots/02-scrolly.png", fullPage: false });

    // 3. Blur overlay (scroll deep into scrolly)
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await page.waitForTimeout(800);
    await page.screenshot({ path: "screenshots/03-blur-overlay.png", fullPage: false });

    // 4. Feature cards
    await page.evaluate(() => document.getElementById("how")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshots/04-feature-cards.png", fullPage: false });

    // 5. Timeline (scroll into it to trigger animations)
    await page.evaluate(() => document.getElementById("compare")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.8));
    await page.waitForTimeout(800);
    await page.screenshot({ path: "screenshots/05-timeline.png", fullPage: false });

    // 6. Compare table
    await page.evaluate(() => document.getElementById("vs")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshots/06-compare-table.png", fullPage: false });

    // 7. Trust sim
    await page.evaluate(() => document.getElementById("sim")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshots/07-trust-sim.png", fullPage: false });

    // 8. Immunity network
    await page.evaluate(() => document.getElementById("network")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshots/08-immunity.png", fullPage: false });

    // 9. CTA
    await page.evaluate(() => document.getElementById("cta")?.scrollIntoView({ behavior: "instant" }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "screenshots/09-cta.png", fullPage: false });

    await browser.close();
    console.log("Done — screenshots/");
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
