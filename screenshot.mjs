import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "fs";
import scenarios from "./screenshots/scenarios.mjs";

// --- Load source files (inlined into HTML for zero-network screenshots) ---
const react = readFileSync("vendor/react.production.min.js", "utf-8");
const reactDom = readFileSync("vendor/react-dom.production.min.js", "utf-8");
const babel = readFileSync("vendor/babel.min.js", "utf-8");
const gameJs = readFileSync("game.js", "utf-8");
const appJsx = readFileSync("app.jsx", "utf-8");

function buildHTML(scenarioJSON, localStorageEntries) {
  const lsScript = localStorageEntries
    ? Object.entries(localStorageEntries)
        .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
        .join("\n")
    : "";

  return `<!DOCTYPE html>
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
  <script>
    window.__HERD_SCENARIO = ${scenarioJSON};
    ${lsScript}
  </script>
  <script type="module">${gameJs}</script>
  <script type="text/babel" data-type="module">${appJsx}</script>
</body>
</html>`;
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
};

async function run() {
  // Filter scenarios by CLI pattern (if provided)
  const pattern = process.argv[2];
  const active = pattern
    ? scenarios.filter(s => s.name.includes(pattern))
    : scenarios;

  if (active.length === 0) {
    console.error(`No scenarios matching "${pattern}"`);
    process.exit(1);
  }

  mkdirSync("screenshots", { recursive: true });

  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const shots = [];
  let passed = 0;
  let failed = 0;

  for (const scenario of active) {
    const viewportNames = scenario.viewports || Object.keys(VIEWPORTS);

    for (const vpName of viewportNames) {
      const viewport = VIEWPORTS[vpName];
      if (!viewport) { console.warn(`  unknown viewport "${vpName}", skipping`); continue; }

      const t0 = performance.now();
      const outPath = `screenshots/${scenario.name}-${vpName}.png`;

      try {
        const html = buildHTML(JSON.stringify(scenario.state), scenario.localStorage);
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();

        await page.setContent(html, { timeout: 30000 });

        // Wait for React to mount and scenario to signal readiness
        await page.waitForFunction(() => window.__HERD_READY === true, { timeout: 15000 });
        // Brief settle for any React re-renders (e.g. state transitions for overlays)
        await page.waitForTimeout(200);

        // Run optional setup (e.g. interactions that can't be expressed as state)
        if (scenario.setup) await scenario.setup(page);

        await page.screenshot({ path: outPath });
        await context.close();

        const ms = Math.round(performance.now() - t0);
        console.log(`  \u2713 ${scenario.name} (${vpName}) \u2014 ${ms}ms`);
        shots.push(outPath);
        passed++;
      } catch (err) {
        const ms = Math.round(performance.now() - t0);
        console.error(`  \u2717 ${scenario.name} (${vpName}) \u2014 ${ms}ms`);
        console.error(`    ${err.message}`);
        failed++;
      }
    }
  }

  await browser.close();

  console.log(`\n${passed + failed} screenshots: ${passed} captured, ${failed} failed`);
  if (shots.length) console.log("Output:", shots.join(", "));
  if (failed) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
