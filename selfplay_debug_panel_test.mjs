// Smoke test for the debug panel — drives it in a real browser (local hotseat mode) and
// asserts the resulting state actually changed. Run with: node selfplay_debug_panel_test.mjs
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.goto(`${BASE_URL}/index.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#btn-local").click();
  await page.locator('#deck-grid .deck-option[data-deck="aggro"]').click();
  await page.waitForTimeout(50);
  await page.locator('#deck-grid .deck-option[data-deck="control"]').click();
  await page.waitForTimeout(50);
  await page.locator('#map-grid .deck-option[data-map="kursk"]').click();
  await page.waitForTimeout(50);
  for (let i = 0; i < 2; i++) {
    const keepBtn = page.locator("#btn-mulligan-keep");
    if (await keepBtn.isVisible().catch(() => false)) { await keepBtn.click(); await page.waitForTimeout(50); }
  }
  await page.locator("#game-area").waitFor({ state: "visible", timeout: 5000 });

  // Open the panel
  await page.locator("#debug-toggle").click();
  await page.locator("#debug-panel").waitFor({ state: "visible" });

  // Add Card
  await page.locator("#debug-card-search").fill("king tiger");
  await page.locator(".debug-card-result").first().click();
  const p1CardsText = await page.locator("#p1-cards").innerText();
  if (!p1CardsText.includes("6")) throw new Error(`Expected P1 hand to grow to 6 cards after Add Card, got: ${p1CardsText}`);

  // Fuel — set then verify uncapped
  await page.locator("#debug-fuel-value").fill("9");
  await page.locator("#debug-fuel-set").click();
  const fuelText = await page.locator("#p1-fuel").innerText();
  if (!fuelText.startsWith("9")) throw new Error(`Expected P1 Fuel to read 9, got: ${fuelText}`);

  // HQ — set to 0, confirm game ends
  await page.locator("#debug-player-p2").click();
  await page.locator("#debug-hq-value").fill("0");
  await page.locator("#debug-hq-set").click();
  await page.locator("#end-screen").waitFor({ state: "visible", timeout: 3000 });

  await browser.close();

  if (pageErrors.length) {
    console.log("FAILED — page errors:", pageErrors);
    process.exit(1);
  }
  console.log("Debug panel smoke test passed.");
})();
