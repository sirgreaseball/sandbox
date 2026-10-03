// Sandbox · poster capture (maintainer tool, not needed to run the dashboard)
//
// Renders every landing chapter once with the real WebGL scene (index.html?capture=N)
// and saves the frames that the 2D fallback cross-fades between when WebGL2 is
// unavailable, software-rendered, or the visitor prefers reduced motion.
//
// Requires Node 18+, the playwright-core package and a local Chrome with a GPU:
//   npm i -g playwright-core   (or run from a folder where it is installed)
//   node tools/capture-posters.mjs
// PNG frames are written to landing/posters/_png/; convert them to WebP with any
// encoder (Team 15 used Pillow: quality 80, method 6) as chapter-N.webp and chapter-N-m.webp.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const out = path.join(root, "landing", "posters", "_png");
fs.mkdirSync(out, { recursive: true });

const variants = [
  { suffix: "", viewport: { width: 1600, height: 1000 }, scale: 1 },
  { suffix: "-m", viewport: { width: 430, height: 932 }, scale: 2 },
];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});

for (const v of variants) {
  const context = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: v.scale });
  for (let chapter = 0; chapter <= 6; chapter++) {
    const page = await context.newPage();
    const url = pathToFileURL(path.join(root, "index.html")).href + `?capture=${chapter}&dpr=${v.scale}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__sandboxCaptureReady === true, null, { timeout: 20000 });
    const file = path.join(out, `chapter-${chapter}${v.suffix}.png`);
    await page.locator("#k-gl").screenshot({ path: file });
    console.log("captured", path.relative(root, file));
    await page.close();
  }
  await context.close();
}

await browser.close();
