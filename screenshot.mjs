import { chromium } from "playwright-core";
import { readFileSync } from "fs";

const react = readFileSync("vendor/react.production.min.js", "utf-8");
const reactDom = readFileSync("vendor/react-dom.production.min.js", "utf-8");
const babel = readFileSync("vendor/babel.min.js", "utf-8");
const gameJs = readFileSync("game.js", "utf-8");
const appJsx = readFileSync("app.jsx", "utf-8");

// Build a fully self-contained HTML page — zero network requests
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>Herd</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      display: flex; justify-content: center; align-items: center;
      background: #1a2410; font-family: 'Courier New', monospace;
      -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none;
    }
    button { touch-action: manipulation; }
    #root { display: flex; justify-content: center; align-items: center; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${react}</script>
  <script>${reactDom}</script>
  <script>${babel}</script>
  <script type="module">${gameJs}</script>
  <script type="text/babel" data-type="module">${appJsx}</script>
</body>
</html>`;

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
};

async function run() {
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const shots = [];

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    await page.setContent(html, { timeout: 30000 });

    // Wait for Babel to compile and React to mount
    await page.waitForSelector("button", { timeout: 15000 });
    await page.waitForTimeout(500);

    // Title screen
    await page.screenshot({ path: `screenshot-${name}-title.png` });
    shots.push(`screenshot-${name}-title.png`);
    console.log(`  captured ${name}-title`);

    // Click START
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll("button")) {
        if (btn.textContent.includes("START")) { btn.click(); break; }
      }
    });

    // Let gameplay run
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `screenshot-${name}-playing.png` });
    shots.push(`screenshot-${name}-playing.png`);
    console.log(`  captured ${name}-playing`);

    // Issue come-bye whistle
    await page.keyboard.down("q");
    await page.waitForTimeout(2000);
    await page.keyboard.up("q");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshot-${name}-herding.png` });
    shots.push(`screenshot-${name}-herding.png`);
    console.log(`  captured ${name}-herding`);

    await context.close();
  }

  await browser.close();
  console.log("\nAll screenshots captured:", shots.join(", "));
}

run().catch(e => { console.error(e); process.exit(1); });
