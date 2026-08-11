import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");
const dashboard = resolve(root, "reports/training-dashboard.html");
const outputDirectory = resolve(root, "reports/screenshots");

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
const page = await context.newPage();
await page.goto(pathToFileURL(dashboard).href, { waitUntil: "load" });

for (const [selector, name] of [
  ["#overview", "01-run-overview.png"],
  ["#training", "02-training-curves.png"],
  ["#evaluation", "03-model-evaluation.png"],
]) {
  await page.locator(selector).screenshot({
    path: resolve(outputDirectory, name),
    animations: "disabled",
  });
}

await browser.close();
console.log(outputDirectory);
