// Playwright self-play harness for SIGNAL (Local Play mode: both seats on one screen).
// Bot logic is intentionally simple/greedy (not an LLM) — it plays whatever it can afford
// and attacks whatever it can reach, so it stresses UI states and combat/objective rules
// without hand-tuned deckplay. Run with: node selfplay_test.mjs [games]
import { chromium } from "playwright";

const NUM_GAMES = Number(process.argv[2] || 3);
const MAX_HALF_TURNS = 160; // safety valve — 80 rounds each
const BASE_URL = "http://localhost:3000";

const DECKS = ["aggro", "control", "counter", "power"];
const MAPS = ["normandy", "stalingrad", "el_alamein", "ardennes", "kursk"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function resolvePendingTargets(page, maxSteps = 6) {
  // After playing a unit/command, the UI may enter attack-targeting or
  // command-targeting state. Click a random valid target tile until clear.
  for (let i = 0; i < maxSteps; i++) {
    const targets = page.locator(".tile.targetable, .tile.cmd-target");
    const count = await targets.count();
    if (count === 0) break;
    await targets.nth(Math.floor(Math.random() * count)).click();
    await page.waitForTimeout(30);
  }
}

async function playHandCards(page, maxAttempts = 8) {
  for (let i = 0; i < maxAttempts; i++) {
    const cards = page.locator("#p1-hand .hand-card");
    const n = await cards.count();
    if (n === 0) break;

    const fuelText = await readActiveFuel(page);
    let played = false;
    for (let ci = 0; ci < n; ci++) {
      const card = cards.nth(ci);
      const costText = await card.locator(".hc-cost").innerText().catch(() => "");
      const cost = parseInt(costText, 10);
      if (Number.isNaN(cost) || cost > fuelText) continue;
      await card.click();
      await page.waitForTimeout(30);

      const dropTiles = page.locator(".tile.valid-drop");
      const dropCount = await dropTiles.count();
      if (dropCount > 0) {
        await dropTiles.nth(Math.floor(Math.random() * dropCount)).click();
        await page.waitForTimeout(30);
        await resolvePendingTargets(page);
        played = true;
        break;
      }
      // Command/mission: may resolve instantly, need a board target, or have none.
      await resolvePendingTargets(page);
      // If a Forward Observer modal popped or Rally Cry second-pick, handle then continue loop.
      await handleForwardObserver(page);
      played = true;
      break;
    }
    if (!played) break; // nothing affordable left in hand
  }
}

async function readActiveFuel(page) {
  const label = await page.locator("#turn-display").innerText().catch(() => "");
  const active = label.includes("P2") ? "p2" : "p1";
  const txt = await page.locator(`#${active}-fuel`).innerText().catch(() => "0 / 0 Fuel");
  const m = txt.match(/(\d+)\s*\/\s*\d+/);
  return m ? parseInt(m[1], 10) : 0;
}

async function attackWithBoardUnits(page) {
  const label = await page.locator("#turn-display").innerText().catch(() => "");
  const active = label.includes("P2") ? "p2" : "p1";
  for (let i = 0; i < 8; i++) {
    const units = page.locator(`.tile:has(.board-card.${active}.normal)`);
    const count = await units.count();
    if (count === 0) break;
    await units.nth(Math.floor(Math.random() * count)).click();
    await page.waitForTimeout(30);
    const before = await page.locator(".tile.targetable").count();
    if (before === 0) continue; // no valid targets — no-op click, try next unit next loop
    await resolvePendingTargets(page);
  }
}

async function handleForwardObserver(page) {
  const modal = page.locator("#fo-modal");
  if (!(await modal.isVisible().catch(() => false))) return;
  const slots = page.locator(".fo-slot");
  const n = await slots.count();
  const positions = ["keep", "top", "bottom"];
  for (let i = 0; i < n; i++) {
    await page.locator(`#fo-btn-${i}-${positions[i] ?? "top"}`).click();
    await page.waitForTimeout(20);
  }
  await page.locator("#fo-confirm").click();
  await page.waitForTimeout(30);
}

async function handleArtyTargeting(page) {
  // Start-of-turn Artillery Position L2/L4 forces a click on an enemy unit.
  const targets = page.locator(".tile.targetable");
  const count = await targets.count();
  if (count > 0) await targets.nth(Math.floor(Math.random() * count)).click();
}

async function playOneGame(page) {
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#btn-local").click();

  // P1 deck, P2 deck (random, can repeat), then map.
  const d1 = pick(DECKS), d2 = pick(DECKS), map = pick(MAPS);
  await page.locator(`#deck-grid .deck-option[data-deck="${d1}"]`).click();
  await page.waitForTimeout(50);
  await page.locator(`#deck-grid .deck-option[data-deck="${d2}"]`).click();
  await page.waitForTimeout(50);
  await page.locator(`#map-grid .deck-option[data-map="${map}"]`).click();
  await page.waitForTimeout(50);

  // Mulligans (P1 then P2) — always keep all, simplest baseline.
  for (let i = 0; i < 2; i++) {
    const keepBtn = page.locator("#btn-mulligan-keep");
    if (await keepBtn.isVisible().catch(() => false)) {
      await keepBtn.click();
      await page.waitForTimeout(50);
    }
  }

  await page.locator("#game-area").waitFor({ state: "visible", timeout: 5000 });

  let halfTurns = 0;
  let notAutomatedHits = 0;
  while (halfTurns < MAX_HALF_TURNS) {
    if (await page.locator("#end-screen").isVisible().catch(() => false)) break;

    await handleForwardObserver(page);
    await handleArtyTargeting(page);
    await playHandCards(page);
    await attackWithBoardUnits(page);
    await handleForwardObserver(page);

    if (await page.locator("#end-screen").isVisible().catch(() => false)) break;
    const endTurnBtn = page.locator("#btn-end-turn");
    if (await endTurnBtn.isEnabled().catch(() => false)) {
      await endTurnBtn.click();
      await page.waitForTimeout(40);
    }
    halfTurns++;
  }

  const gameOver = await page.locator("#end-screen").isVisible().catch(() => false);
  const winner = gameOver ? await page.locator("#end-winner").innerText().catch(() => "?") : "TIMEOUT (no winner)";
  const p1hq = await page.locator("#p1-hq").innerText().catch(() => "?");
  const p2hq = await page.locator("#p2-hq").innerText().catch(() => "?");
  const logText = await page.locator("#game-log").innerText().catch(() => "");
  const notAutomatedMatches = logText.match(/not automated/gi) || [];

  return {
    deck1: d1, deck2: d2, map, winner,
    rounds: Math.ceil(halfTurns / 2),
    finalHQ: { p1: p1hq, p2: p2hq },
    notAutomatedTriggers: notAutomatedMatches.length,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const consoleErrors = [];
  const pageErrors = [];

  for (let g = 0; g < NUM_GAMES; g++) {
    const page = await browser.newPage();
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(`game${g + 1}: ${msg.text()}`); });
    page.on("pageerror", err => pageErrors.push(`game${g + 1}: ${err.message}`));
    try {
      const result = await playOneGame(page);
      results.push(result);
      console.log(`Game ${g + 1}: ${result.deck1} vs ${result.deck2} on ${result.map} → ${result.winner} (${result.rounds} rounds, HQ p1=${result.finalHQ.p1} p2=${result.finalHQ.p2}, not-automated log hits=${result.notAutomatedTriggers})`);
    } catch (e) {
      console.log(`Game ${g + 1}: CRASHED — ${e.message}`);
      await page.screenshot({ path: `selfplay_crash_${g + 1}.png` }).catch(() => {});
    }
    await page.close();
  }

  await browser.close();

  console.log("\n--- Summary ---");
  console.log(`Games played: ${results.length}/${NUM_GAMES}`);
  const timeouts = results.filter(r => r.winner.includes("TIMEOUT"));
  console.log(`Timeouts (hit ${MAX_HALF_TURNS / 2}-round cap, no winner): ${timeouts.length}`);
  const avgRounds = results.length ? (results.reduce((a, r) => a + r.rounds, 0) / results.length).toFixed(1) : "n/a";
  console.log(`Average game length: ${avgRounds} rounds`);
  console.log(`Total "not automated" log lines hit: ${results.reduce((a, r) => a + r.notAutomatedTriggers, 0)}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 20).forEach(e => console.log("  " + e));
  console.log(`Uncaught page errors: ${pageErrors.length}`);
  pageErrors.slice(0, 20).forEach(e => console.log("  " + e));
})();
