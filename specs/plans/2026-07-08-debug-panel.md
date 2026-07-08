# Debug Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-visible debug panel to the SIGNAL digital prototype (`digital/game.html`) that lets a tester add a card to either player's hand, set/adjust Fuel and HQ Health, force objective control/level, force a unit's Suppressed/Destroyed/Normal state, draw extra cards, and skip to a specific turn — without playing a full game to reach that state.

**Architecture:** Pure state-transformation logic lives in a new `digital/js/debug.js` module (same pattern as `state.js`/`combat.js` — takes a `GameState`, returns a new one plus log lines, no DOM access, fully unit-testable with plain Node). UI wiring (buttons, inputs, board-click capture) lives in `digital/js/game.js` next to every other click handler, and every debug action ends by calling the existing `commitState()` so Firebase sync for online play comes for free with no new sync path.

**Tech Stack:** Vanilla JS ES modules, no framework. Tests use Node's built-in `assert/strict` (matches the project's existing no-framework convention — see `digital/selfplay_test.mjs`) and Playwright for one end-to-end smoke test.

**Reference:** Design spec at `digital/specs/2026-07-08-debug-panel-design.md`. Approved visual mockup at `digital/debug_panel_preview.html`.

---

## File Structure

- **Create:** `digital/js/debug.js` — pure functions: `debugAddCard`, `debugSetFuel`, `debugAdjustFuel`, `debugSetHQ`, `debugAdjustHQ`, `debugSetObjective`, `debugSetUnitState`, `debugDrawCards`, `debugSkipToTurn`. Each takes `(state, ...args)` and returns `{ state, log }`.
- **Create:** `digital/js/debug.test.mjs` — plain-Node assertion tests for every function in `debug.js`.
- **Create:** `digital/selfplay_debug_panel_test.mjs` — one Playwright script that drives the panel end-to-end in a real browser (local hotseat mode) and asserts the resulting DOM/state.
- **Modify:** `digital/game.html` — add the toggle button + panel markup (mirrors the existing `#fo-modal` pattern), inserted after the `#end-screen` block (~line 112).
- **Modify:** `digital/js/game.js` — import `debug.js`, add a new `'debug-unit-select'` uiState branch to the board click handler, add a new `── Debug Panel ──` section near the bottom wiring every button/input.
- **Modify:** `digital/css/game.css` — append debug panel styles (adapted from the approved mockup's inline `<style>` block).

---

### Task 1: Pure debug-logic module

**Files:**
- Create: `digital/js/debug.js`
- Test: `digital/js/debug.test.mjs`

- [ ] **Step 1: Write the failing test file**

Create `digital/js/debug.test.mjs`:

```js
import assert from 'node:assert/strict';
import { CARD_BY_ID } from './cards.js';
import {
  debugAddCard, debugSetFuel, debugAdjustFuel, debugSetHQ, debugAdjustHQ,
  debugSetObjective, debugSetUnitState, debugDrawCards, debugSkipToTurn,
} from './debug.js';

function baseState() {
  return {
    turn: 3,
    initiative: 'p1',
    board: {
      '0,0': { cardId: 9, owner: 'p1', state: 'normal', armorHits: 0, tempKeywords: [], grantedKeywords: [], tempSideBonus: 0, justPlaced: false },
      '0,1': null,
    },
    objectives: {
      '1,0': { cardId: 26, level: 1, controller: 'p1' },
    },
    p1: { hq: 25, fuel: 3, pendingFuelGain: 0, hand: [1, 2], deck: [3, 4, 5], missions: [], tempFuelDiscount: 0 },
    p2: { hq: 25, fuel: 3, pendingFuelGain: 0, hand: [], deck: [6, 7], missions: [], tempFuelDiscount: 0 },
    log: [],
  };
}

// debugAddCard
{
  const s = baseState();
  const { state, log } = debugAddCard(s, 'p2', 66);
  assert.deepEqual(state.p2.hand, [66]);
  assert.equal(state.p1.hand.length, 2); // untouched
  assert.match(log[0], /King Tiger/);
  assert.match(log[0], /P2/);
}

// debugSetFuel — exact value, uncapped above 6
{
  const s = baseState();
  const { state } = debugSetFuel(s, 'p1', 9);
  assert.equal(state.p1.fuel, 9);
}

// debugSetFuel — floors at 0
{
  const s = baseState();
  const { state } = debugSetFuel(s, 'p1', -5);
  assert.equal(state.p1.fuel, 0);
}

// debugAdjustFuel — delta from current value
{
  const s = baseState();
  const { state } = debugAdjustFuel(s, 'p1', 5);
  assert.equal(state.p1.fuel, 8); // 3 + 5, uncapped
}

// debugSetHQ — floors at 0, no ceiling
{
  const s = baseState();
  const { state } = debugSetHQ(s, 'p2', 40);
  assert.equal(state.p2.hq, 40);
}

// debugAdjustHQ
{
  const s = baseState();
  const { state } = debugAdjustHQ(s, 'p1', -30);
  assert.equal(state.p1.hq, 0); // floored, not negative
}

// debugSetObjective — sets controller and level
{
  const s = baseState();
  const { state, log } = debugSetObjective(s, '1,0', 'p2', 4);
  assert.equal(state.objectives['1,0'].controller, 'p2');
  assert.equal(state.objectives['1,0'].level, 4);
  assert.match(log[0], /Factory/);
}

// debugSetObjective — 'neutral' maps to controller: null
{
  const s = baseState();
  const { state } = debugSetObjective(s, '1,0', 'neutral', 2);
  assert.equal(state.objectives['1,0'].controller, null);
}

// debugSetUnitState — suppress
{
  const s = baseState();
  const { state, log } = debugSetUnitState(s, '0,0', 'suppressed');
  assert.equal(state.board['0,0'].state, 'suppressed');
  assert.match(log[0], /Heavy Tank/);
}

// debugSetUnitState — destroy removes the unit from the board
{
  const s = baseState();
  const { state } = debugSetUnitState(s, '0,0', 'destroyed');
  assert.equal(state.board['0,0'], null);
}

// debugSetUnitState — reset clears armorHits back to 0
{
  const s = baseState();
  s.board['0,0'].armorHits = 2;
  const { state } = debugSetUnitState(s, '0,0', 'normal');
  assert.equal(state.board['0,0'].state, 'normal');
  assert.equal(state.board['0,0'].armorHits, 0);
}

// debugSetUnitState — clicking an empty tile is a no-op
{
  const s = baseState();
  const { state, log } = debugSetUnitState(s, '0,1', 'suppressed');
  assert.equal(state, s); // same reference, nothing changed
  assert.deepEqual(log, []);
}

// debugDrawCards
{
  const s = baseState();
  const { state, log } = debugDrawCards(s, 'p1', 2);
  assert.deepEqual(state.p1.hand, [1, 2, 3, 4]);
  assert.deepEqual(state.p1.deck, [5]);
  assert.match(log[0], /P1 drew 2/);
}

// debugSkipToTurn — sets turn, recalculates objective level for that turn
{
  const s = baseState();
  const { state, log } = debugSkipToTurn(s, 9); // turn 9 → objectiveLevel should be 4 (turn 8+)
  assert.equal(state.turn, 9);
  assert.equal(state.objectives['1,0'].level, 4);
  assert.match(log[0], /Round 5/); // Math.ceil(9/2) = 5
}

console.log('All debug.js tests passed.');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node digital/js/debug.test.mjs`
Expected: `Cannot find module './debug.js'` (or similar import error) — `debug.js` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `digital/js/debug.js`:

```js
// Pure state-transformation functions for the debug panel (digital/js/game.js wires these to
// UI). No DOM access here — every function takes a GameState and returns { state, log }, same
// pattern as state.js, so this file can be tested with plain Node and no browser.

import { CARD_BY_ID } from './cards.js';
import { drawCards, updateObjectiveLevels, checkObjectiveControl } from './state.js';

export function debugAddCard(state, player, cardId) {
  const card = CARD_BY_ID[cardId];
  const newState = { ...state, [player]: { ...state[player], hand: [...state[player].hand, cardId] } };
  return { state: newState, log: [`[DEBUG] Added ${card.name} to ${player.toUpperCase()}'s hand`] };
}

export function debugSetFuel(state, player, value) {
  const v = Math.max(0, value);
  const newState = { ...state, [player]: { ...state[player], fuel: v } };
  return { state: newState, log: [`[DEBUG] Set ${player.toUpperCase()} Fuel to ${v}`] };
}

export function debugAdjustFuel(state, player, delta) {
  return debugSetFuel(state, player, state[player].fuel + delta);
}

export function debugSetHQ(state, player, value) {
  const v = Math.max(0, value);
  const newState = { ...state, [player]: { ...state[player], hq: v } };
  return { state: newState, log: [`[DEBUG] Set ${player.toUpperCase()} HQ to ${v}`] };
}

export function debugAdjustHQ(state, player, delta) {
  return debugSetHQ(state, player, state[player].hq + delta);
}

export function debugSetObjective(state, tileKey, controller, level) {
  const obj = state.objectives[tileKey];
  const resolvedController = controller === 'neutral' ? null : controller;
  const newObj = { ...obj, controller: resolvedController, level };
  const newState = { ...state, objectives: { ...state.objectives, [tileKey]: newObj } };
  const name = CARD_BY_ID[obj.cardId]?.name ?? '?';
  return { state: newState, log: [`[DEBUG] ${name} set to ${controller.toUpperCase()} L${level}`] };
}

export function debugSetUnitState(state, tileKey, newUnitState) {
  const unit = state.board[tileKey];
  if (!unit) return { state, log: [] };
  const updated = newUnitState === 'destroyed'
    ? null
    : { ...unit, state: newUnitState, armorHits: newUnitState === 'normal' ? 0 : unit.armorHits };
  const newState = { ...state, board: { ...state.board, [tileKey]: updated } };
  const name = CARD_BY_ID[unit.cardId]?.name ?? '?';
  return { state: newState, log: [`[DEBUG] ${name} set to ${newUnitState}`] };
}

export function debugDrawCards(state, player, n) {
  const newPs = drawCards(state[player], n);
  const newState = { ...state, [player]: newPs };
  return { state: newState, log: [`[DEBUG] ${player.toUpperCase()} drew ${n} card(s)`] };
}

export function debugSkipToTurn(state, turn) {
  let newState = { ...state, turn };
  newState = updateObjectiveLevels(newState);
  newState = checkObjectiveControl(newState);
  const round = Math.ceil(turn / 2);
  return { state: newState, log: [`[DEBUG] Turn set to ${turn} (Round ${round})`] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node digital/js/debug.test.mjs`
Expected: `All debug.js tests passed.` with exit code 0.

- [ ] **Step 5: Commit**

```bash
cd digital
git add js/debug.js js/debug.test.mjs
git commit -m "Add pure debug-panel state functions with unit tests"
```

---

### Task 2: Debug panel HTML markup

**Files:**
- Modify: `digital/game.html:112` (insert after the `#end-screen` block, before `<!-- ── GAME AREA ── -->`)

- [ ] **Step 1: Insert the markup**

In `digital/game.html`, after line 112 (`  </div>` closing `#end-screen`) and before line 114 (`  <!-- ── GAME AREA ── -->`), insert:

```html

  <!-- ── DEBUG PANEL ── -->
  <button class="debug-toggle" id="debug-toggle">⚙ DEBUG</button>
  <div class="debug-panel" id="debug-panel" style="display:none">
    <div class="debug-panel-header">
      <span class="title">DEBUG PANEL</span>
      <button class="debug-close" id="debug-close">✕</button>
    </div>

    <div class="debug-player-select">
      <button class="debug-player-btn active" id="debug-player-p1" data-player="p1">TARGET: P1</button>
      <button class="debug-player-btn" id="debug-player-p2" data-player="p2">TARGET: P2</button>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">Add Card to Hand</div>
      <div class="debug-row">
        <input class="debug-input" id="debug-card-search" placeholder="Search card name…">
      </div>
      <div id="debug-card-results"></div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">Fuel</div>
      <div class="debug-row">
        <input class="debug-input" type="number" id="debug-fuel-value" style="flex:0 0 60px;">
        <button class="debug-btn" id="debug-fuel-set">Set</button>
        <div class="debug-btn-row" style="margin-left:auto;">
          <button class="debug-btn small secondary" data-fuel-delta="-5">−5</button>
          <button class="debug-btn small secondary" data-fuel-delta="-1">−1</button>
          <button class="debug-btn small secondary" data-fuel-delta="1">+1</button>
          <button class="debug-btn small secondary" data-fuel-delta="5">+5</button>
        </div>
      </div>
      <div class="debug-hint">Uncapped — can exceed the normal 6 Fuel limit.</div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">HQ Health</div>
      <div class="debug-row">
        <input class="debug-input" type="number" id="debug-hq-value" style="flex:0 0 60px;">
        <button class="debug-btn" id="debug-hq-set">Set</button>
        <div class="debug-btn-row" style="margin-left:auto;">
          <button class="debug-btn small secondary" data-hq-delta="-5">−5</button>
          <button class="debug-btn small secondary" data-hq-delta="-1">−1</button>
          <button class="debug-btn small secondary" data-hq-delta="1">+1</button>
          <button class="debug-btn small secondary" data-hq-delta="5">+5</button>
        </div>
      </div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">Objective Control / Level</div>
      <div class="debug-row">
        <select class="debug-input" id="debug-obj-select"></select>
      </div>
      <div class="debug-row">
        <select class="debug-input" id="debug-obj-controller" style="flex:0 0 90px;">
          <option value="p1">P1</option>
          <option value="p2">P2</option>
          <option value="neutral">Neutral</option>
        </select>
        <select class="debug-input" id="debug-obj-level" style="flex:0 0 70px;">
          <option value="1">L1</option>
          <option value="2">L2</option>
          <option value="3">L3</option>
          <option value="4">L4</option>
        </select>
        <button class="debug-btn" id="debug-obj-apply">Apply</button>
      </div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">Unit State</div>
      <div class="debug-hint" id="debug-unit-hint" style="margin-top:0; margin-bottom:6px;">Click "Select Unit", then click a unit on the board.</div>
      <div class="debug-btn-row" style="margin-bottom:6px;">
        <button class="debug-btn secondary" id="debug-unit-select-btn" style="flex:1;">Select Unit</button>
      </div>
      <div class="debug-btn-row">
        <button class="debug-btn secondary" id="debug-unit-suppress" style="flex:1;">Suppress</button>
        <button class="debug-btn secondary" id="debug-unit-destroy" style="flex:1;">Destroy</button>
        <button class="debug-btn secondary" id="debug-unit-reset" style="flex:1;">Reset</button>
      </div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">Draw Cards</div>
      <div class="debug-row">
        <input class="debug-input" type="number" id="debug-draw-count" value="1" style="flex:0 0 60px;">
        <button class="debug-btn" id="debug-draw-go">Draw</button>
      </div>
    </div>

    <div class="debug-section">
      <div class="debug-section-title">Skip to Turn</div>
      <div class="debug-row">
        <input class="debug-input" type="number" id="debug-turn-value" style="flex:0 0 60px;">
        <button class="debug-btn" id="debug-turn-go">Jump</button>
      </div>
      <div class="debug-hint">Recalculates objective levels/control for that turn. Does not simulate Fuel/draws/mission timers for turns in between.</div>
    </div>
  </div>
```

- [ ] **Step 2: Verify the markup is well-formed**

Run: `node -e "require('fs').readFileSync('digital/game.html', 'utf8')" ` — this just confirms the file is still readable/no corruption from the edit. Then open `digital/game.html` in a text editor and confirm every opened `<div>` has a matching `</div>` for the inserted block (11 `.debug-section` divs, each opened and closed).

- [ ] **Step 3: Commit**

```bash
cd digital
git add game.html
git commit -m "Add debug panel HTML markup (unwired, hidden by default)"
```

---

### Task 3: Debug panel CSS

**Files:**
- Modify: `digital/css/game.css` (append to end of file)

- [ ] **Step 1: Append the styles**

At the end of `digital/css/game.css`, add:

```css

/* ── Debug Panel ── */
.debug-toggle {
  position: fixed; bottom: 20px; right: 20px; z-index: 500;
  padding: 10px 18px; border-radius: 4px; border: 1px solid var(--gold-dim);
  background: var(--gold-bg); color: var(--gold); font-weight: bold; letter-spacing: 1px;
  font-family: 'Arial Narrow', Arial, sans-serif; font-size: 12px; cursor: pointer;
}
.debug-toggle:hover { background: var(--gold-bg-b); }

.debug-panel {
  position: fixed; bottom: 68px; right: 20px; z-index: 500;
  width: 340px; max-height: 78vh; overflow-y: auto;
  background: var(--bg-alt); border: 1px solid var(--gold-dim); border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  font-family: Arial, sans-serif;
}
.debug-panel-header {
  padding: 10px 14px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.debug-panel-header .title {
  color: var(--gold); font-weight: bold; letter-spacing: 1px; font-size: 12px;
  font-family: 'Arial Narrow', Arial, sans-serif;
}
.debug-close { background: none; border: none; color: var(--text-c); cursor: pointer; font-size: 14px; }

.debug-player-select {
  display: flex; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--border);
}
.debug-player-btn {
  flex: 1; padding: 6px; border-radius: 3px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text-b); font-size: 11px; font-weight: bold;
  cursor: pointer; font-family: 'Arial Narrow', Arial, sans-serif;
}
.debug-player-btn.active {
  background: var(--gold-bg); color: var(--gold); border-color: var(--gold-dim);
}

.debug-section { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.debug-section:last-child { border-bottom: none; }
.debug-section-title {
  color: var(--text-b); font-size: 10px; font-weight: bold; letter-spacing: 1px;
  text-transform: uppercase; margin-bottom: 8px;
  font-family: 'Arial Narrow', Arial, sans-serif;
}
.debug-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.debug-row:last-child { margin-bottom: 0; }
.debug-input {
  flex: 1; padding: 6px 8px; border-radius: 3px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-size: 12px;
}
.debug-btn {
  padding: 6px 10px; border-radius: 3px; border: none; cursor: pointer;
  font-size: 11px; font-weight: bold; font-family: 'Arial Narrow', Arial, sans-serif;
  background: var(--btn-p-bg, #2a5); color: var(--btn-p-text, #fff);
}
.debug-btn.secondary { background: var(--bg); color: var(--text-b); border: 1px solid var(--border); }
.debug-btn.small { padding: 6px 6px; min-width: 28px; font-size: 10px; }
.debug-btn-row { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.debug-btn.selected { background: var(--gold-bg); color: var(--gold); border: 1px solid var(--gold-dim); }
.debug-hint { color: var(--text-c); font-size: 10px; margin-top: 4px; line-height: 1.4; }

.debug-card-result {
  font-size: 11px; color: var(--text-b); padding: 4px 6px; background: var(--bg);
  border-radius: 3px; cursor: pointer; margin-top: 2px;
}
.debug-card-result:hover { color: var(--gold); }
```

- [ ] **Step 2: Verify visually**

Run: `npx serve digital -p 3000` (from the `wwii-card-game` directory), open `http://localhost:3000/game.html` in a browser, start a local game. Confirm the gold "⚙ DEBUG" button appears bottom-right. Click it — panel should open showing all 7 sections with dark-theme styling matching the rest of the game (compare against `digital/debug_panel_preview.html` side by side). Click the ✕ or the toggle again — panel should not yet close, since no JS is wired up (expected at this stage — wiring is Task 4+). Stop the server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
cd digital
git add css/game.css
git commit -m "Add debug panel styles"
```

---

### Task 4: Wire panel open/close and player selector

**Files:**
- Modify: `digital/js/game.js` (append new section near the end of the file, after the existing `btn-end-turn` listener block)

- [ ] **Step 1: Add the debug section header and state variable**

At the end of `digital/js/game.js`, add:

```js

// ── Debug Panel ──────────────────────────────────────────────────────────────
import { debugAddCard, debugSetFuel, debugAdjustFuel, debugSetHQ, debugAdjustHQ, debugSetObjective, debugSetUnitState, debugDrawCards, debugSkipToTurn } from './debug.js?v=1783502012';

let debugTargetPlayer = 'p1';
let debugSelectingUnit = false;
let debugSelectedUnitKey = null;

document.getElementById('debug-toggle').addEventListener('click', () => {
  const panel = document.getElementById('debug-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('debug-close').addEventListener('click', () => {
  document.getElementById('debug-panel').style.display = 'none';
});

document.getElementById('debug-player-p1').addEventListener('click', () => setDebugPlayer('p1'));
document.getElementById('debug-player-p2').addEventListener('click', () => setDebugPlayer('p2'));

function setDebugPlayer(player) {
  debugTargetPlayer = player;
  document.getElementById('debug-player-p1').classList.toggle('active', player === 'p1');
  document.getElementById('debug-player-p2').classList.toggle('active', player === 'p2');
}
```

*Note:* imports must be at the top of an ES module in real JS syntax — this plan places the `import` line inline in the "append to end of file" instruction for readability, but when editing, move that one `import` line up to sit with the other `import` statements at the very top of `game.js` (next to the existing `cards.js`/`state.js`/etc. imports). Everything else in this task (the three `let` declarations and the four listeners) does go at the end of the file.

- [ ] **Step 2: Verify manually**

Run: `npx serve digital -p 3000`, open `game.html`, start a local game. Click "⚙ DEBUG" — panel opens. Click "TARGET: P2" — its button should highlight gold and P1's should un-highlight. Click ✕ — panel closes. Click "⚙ DEBUG" again — panel re-opens (state of P1/P2 selection persists since `debugTargetPlayer` is a module-level variable). Open the browser console — confirm no errors.

- [ ] **Step 3: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel open/close and player selector"
```

---

### Task 5: Wire Add Card

**Files:**
- Modify: `digital/js/game.js` (append to the `── Debug Panel ──` section)

- [ ] **Step 1: Add the search + add-to-hand wiring**

```js

document.getElementById('debug-card-search').addEventListener('input', e => {
  const query = e.target.value.trim().toLowerCase();
  const results = document.getElementById('debug-card-results');
  results.innerHTML = '';
  if (!query) return;
  const matches = CARDS.filter(c => c.name.toLowerCase().includes(query)).slice(0, 8);
  for (const card of matches) {
    const el = document.createElement('div');
    el.className = 'debug-card-result';
    el.textContent = `${card.name} (${card.id}) — ${card.cls || card.type}`;
    el.addEventListener('click', () => {
      if (!state) return;
      const { state: newState, log } = debugAddCard(state, debugTargetPlayer, card.id);
      commitState(newState, log);
      document.getElementById('debug-card-search').value = '';
      results.innerHTML = '';
    });
    results.appendChild(el);
  }
});
```

This needs `CARDS` (the full array, not just `CARD_BY_ID`) imported from `cards.js`. Update the existing top-of-file import (`digital/js/game.js:1`) from:

```js
import { CARD_BY_ID } from './cards.js?v=1783502012';
```

to:

```js
import { CARD_BY_ID, CARDS } from './cards.js?v=1783502012';
```

- [ ] **Step 2: Verify manually**

Reload the game, open the debug panel, type "king" into the Add Card search box. "King Tiger (66) — Tank" should appear as a clickable result. Click it. Open the hand of whichever player is targeted (P1 by default) — King Tiger should now be in hand. Check the game log — a `[DEBUG] Added King Tiger to P1's hand` line should appear.

- [ ] **Step 3: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel Add Card search"
```

---

### Task 6: Wire Fuel

**Files:**
- Modify: `digital/js/game.js`

- [ ] **Step 1: Add the wiring**

```js

document.getElementById('debug-fuel-set').addEventListener('click', () => {
  if (!state) return;
  const value = Number(document.getElementById('debug-fuel-value').value);
  const { state: newState, log } = debugSetFuel(state, debugTargetPlayer, value);
  commitState(newState, log);
});

document.querySelectorAll('[data-fuel-delta]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state) return;
    const delta = Number(btn.dataset.fuelDelta);
    const { state: newState, log } = debugAdjustFuel(state, debugTargetPlayer, delta);
    commitState(newState, log);
  });
});
```

- [ ] **Step 2: Verify manually**

Open the debug panel, type `9` into the Fuel field, click Set. The targeted player's Fuel stat (top HQ panel) should read `9 / 6 Fuel` (uncapped — the display just shows the raw number over the normal max, confirming the cap was bypassed). Click `−5`. Fuel should drop to `4`. Click `+1` four times. Fuel should reach `8`.

- [ ] **Step 3: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel Fuel controls"
```

---

### Task 7: Wire HQ Health

**Files:**
- Modify: `digital/js/game.js`

- [ ] **Step 1: Add the wiring**

```js

document.getElementById('debug-hq-set').addEventListener('click', () => {
  if (!state) return;
  const value = Number(document.getElementById('debug-hq-value').value);
  const { state: newState, log } = debugSetHQ(state, debugTargetPlayer, value);
  commitState(newState, log);
  checkWin();
});

document.querySelectorAll('[data-hq-delta]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state) return;
    const delta = Number(btn.dataset.hqDelta);
    const { state: newState, log } = debugAdjustHQ(state, debugTargetPlayer, delta);
    commitState(newState, log);
    checkWin();
  });
});
```

*Note:* `checkWin()` is called after every HQ change because the debug panel is explicitly allowed to end the game by setting HQ to 0 (per the design spec) — this reuses the same win-check the rest of the game already calls after HQ-affecting actions.

- [ ] **Step 2: Verify manually**

Set HQ to `3` for P2, click Set. Click `−5` on the HQ row. P2's HQ should floor at `0` and the end-game overlay should appear declaring P1 the winner (confirms `checkWin()` fired correctly).

- [ ] **Step 3: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel HQ Health controls"
```

---

### Task 8: Wire Objective control/level

**Files:**
- Modify: `digital/js/game.js`

- [ ] **Step 1: Add a function to populate the dropdown, called from `redraw()`**

Add this function in the `── Debug Panel ──` section:

```js

function populateDebugObjectiveDropdown() {
  if (!state) return;
  const select = document.getElementById('debug-obj-select');
  const prevValue = select.value;
  select.innerHTML = '';
  for (const [key, obj] of Object.entries(state.objectives)) {
    const name = CARD_BY_ID[obj.cardId]?.name ?? '?';
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${name} (${key})`;
    select.appendChild(opt);
  }
  if ([...select.options].some(o => o.value === prevValue)) select.value = prevValue;
}
```

Now call it from the existing `redraw()` function (`digital/js/game.js`, the function that starts `function redraw() {`). Add one line at the end of `redraw()`, right before its closing `}`:

```js
  populateDebugObjectiveDropdown();
}
```

- [ ] **Step 2: Add the Apply button wiring**

```js

document.getElementById('debug-obj-apply').addEventListener('click', () => {
  if (!state) return;
  const tileKey = document.getElementById('debug-obj-select').value;
  if (!tileKey) return;
  const controller = document.getElementById('debug-obj-controller').value;
  const level = Number(document.getElementById('debug-obj-level').value);
  const { state: newState, log } = debugSetObjective(state, tileKey, controller, level);
  commitState(newState, log);
});
```

- [ ] **Step 3: Verify manually**

Open the debug panel. The Objective dropdown should list the 1-2 objectives currently placed on the map (e.g. "Factory (1,0)"). Select one, set controller to P2 and level to L4, click Apply. The board's objective tile should visually update (its control indicator/level badge) to reflect P2 at L4 on the next render.

- [ ] **Step 4: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel objective control/level"
```

---

### Task 9: Wire Unit State (select + Suppress/Destroy/Reset)

**Files:**
- Modify: `digital/js/game.js`

- [ ] **Step 1: Add the "Select Unit" toggle**

```js

document.getElementById('debug-unit-select-btn').addEventListener('click', () => {
  debugSelectingUnit = true;
  debugSelectedUnitKey = null;
  document.getElementById('debug-unit-hint').textContent = 'Click a unit on the board now…';
});
```

- [ ] **Step 2: Intercept the board click handler**

Find the board click handler in `digital/js/game.js` — it starts with:

```js
document.getElementById('board').addEventListener('click', e => {
  if (gameOver || !state) return;
  if (isOnline && state.initiative !== myRole) return;
  const tile = e.target.closest('.tile');
  if (!tile) return;
  const clickedKey = tile.dataset.key;

  // ARTILLERY POSITION TARGETING
  if (uiState === 'arty-targeting') {
```

Add a new branch immediately after `const clickedKey = tile.dataset.key;` and before the `// ARTILLERY POSITION TARGETING` comment:

```js
  // DEBUG UNIT SELECTION — takes priority over every other board-click mode, and
  // deliberately does not check the isOnline turn-gate above (the debug panel must be
  // able to select and edit either player's units regardless of whose turn it is).
  if (debugSelectingUnit) {
    const unit = state.board[clickedKey];
    if (!unit) return;
    debugSelectedUnitKey = clickedKey;
    debugSelectingUnit = false;
    const name = CARD_BY_ID[unit.cardId]?.name ?? '?';
    document.getElementById('debug-unit-hint').textContent = `Selected: ${name} at ${clickedKey}`;
    return;
  }
```

*Note:* this branch runs before the `if (isOnline && state.initiative !== myRole) return;` check would otherwise block it — but that check is on the line above the branch insertion point, so it always runs first. Since debug actions are meant to bypass the turn-gate, move the debug branch to before that check instead. The corrected full top of the handler should read:

```js
document.getElementById('board').addEventListener('click', e => {
  if (gameOver || !state) return;
  const tile = e.target.closest('.tile');
  if (!tile) return;
  const clickedKey = tile.dataset.key;

  // DEBUG UNIT SELECTION — takes priority over every other board-click mode, and
  // deliberately does not check the isOnline turn-gate below (the debug panel must be
  // able to select and edit either player's units regardless of whose turn it is).
  if (debugSelectingUnit) {
    const unit = state.board[clickedKey];
    if (!unit) return;
    debugSelectedUnitKey = clickedKey;
    debugSelectingUnit = false;
    const name = CARD_BY_ID[unit.cardId]?.name ?? '?';
    document.getElementById('debug-unit-hint').textContent = `Selected: ${name} at ${clickedKey}`;
    return;
  }

  if (isOnline && state.initiative !== myRole) return;

  // ARTILLERY POSITION TARGETING
  if (uiState === 'arty-targeting') {
```

- [ ] **Step 3: Add Suppress/Destroy/Reset wiring**

```js

function applyDebugUnitState(newUnitState) {
  if (!state || !debugSelectedUnitKey) {
    appendLog(['[DEBUG] No unit selected — click "Select Unit" first.']);
    return;
  }
  const { state: newState, log } = debugSetUnitState(state, debugSelectedUnitKey, newUnitState);
  commitState(newState, log);
  if (newUnitState === 'destroyed') {
    debugSelectedUnitKey = null;
    document.getElementById('debug-unit-hint').textContent = 'Click "Select Unit", then click a unit on the board.';
  }
  checkWin();
}

document.getElementById('debug-unit-suppress').addEventListener('click', () => applyDebugUnitState('suppressed'));
document.getElementById('debug-unit-destroy').addEventListener('click', () => applyDebugUnitState('destroyed'));
document.getElementById('debug-unit-reset').addEventListener('click', () => applyDebugUnitState('normal'));
```

- [ ] **Step 4: Verify manually**

Place a unit on the board during a local game. Open the debug panel, click "Select Unit", then click that unit's tile. The hint text should read "Selected: <card name> at <r,c>". Click "Suppress" — the unit should visually show as Suppressed. Click "Reset" — it should return to Normal. Click "Destroy" — the unit should disappear from the board and the hint should reset to the initial prompt.

- [ ] **Step 5: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel unit state (select, Suppress/Destroy/Reset)"
```

---

### Task 10: Wire Draw Cards

**Files:**
- Modify: `digital/js/game.js`

- [ ] **Step 1: Add the wiring**

```js

document.getElementById('debug-draw-go').addEventListener('click', () => {
  if (!state) return;
  const n = Number(document.getElementById('debug-draw-count').value);
  if (n <= 0) return;
  const { state: newState, log } = debugDrawCards(state, debugTargetPlayer, n);
  commitState(newState, log);
});
```

- [ ] **Step 2: Verify manually**

Open the debug panel, set Draw Cards to `3`, click Draw. The targeted player's hand should grow by 3 cards (or fewer if their deck ran low — confirm the log line matches how many actually got drawn if the deck is short, since `drawCards()` stops when the deck is empty).

- [ ] **Step 3: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel Draw Cards"
```

---

### Task 11: Wire Skip to Turn

**Files:**
- Modify: `digital/js/game.js`

- [ ] **Step 1: Add the wiring**

```js

document.getElementById('debug-turn-go').addEventListener('click', () => {
  if (!state) return;
  const turn = Number(document.getElementById('debug-turn-value').value);
  if (turn < 1) return;
  const { state: newState, log } = debugSkipToTurn(state, turn);
  commitState(newState, log);
});
```

- [ ] **Step 2: Verify manually**

Open the debug panel, set Skip to Turn to `9`, click Jump. The turn/round display should update to reflect turn 9 (Round 5). Any objective on the board should escalate to L4 (per `objectiveLevel`, turn 8+ is L4) — confirm its level badge updates. Confirm Fuel and hand size were NOT affected by the jump (per spec, this does not simulate the skipped turns).

- [ ] **Step 3: Commit**

```bash
cd digital
git add js/game.js
git commit -m "Wire debug panel Skip to Turn"
```

---

### Task 12: End-to-end Playwright smoke test

**Files:**
- Create: `digital/selfplay_debug_panel_test.mjs`

- [ ] **Step 1: Write the test**

```js
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
```

- [ ] **Step 2: Run the test to verify it fails (server not running yet / panel not wired if run out of order)**

Run:
```bash
cd digital
npx serve . -p 3000 &
node selfplay_debug_panel_test.mjs
```
Expected at this point in the plan (all prior tasks done): the test should actually PASS, since Tasks 1-11 already wired everything it exercises. If any assertion throws, read the error — it names exactly which debug action didn't produce the expected DOM state, fix that task's wiring, and re-run.

- [ ] **Step 3: Confirm it passes**

Expected output: `Debug panel smoke test passed.` and exit code 0. Stop the server (`kill %1` or Ctrl+C on the `npx serve` job).

- [ ] **Step 4: Commit**

```bash
cd digital
git add selfplay_debug_panel_test.mjs
git commit -m "Add end-to-end smoke test for the debug panel"
```

---

### Task 13: Documentation and cleanup

**Files:**
- Modify: `digital/STATUS.md`
- Modify: `digital/DEVNOTES.md`
- Delete: `digital/debug_panel_preview.html` (superseded by the real, wired panel)

- [ ] **Step 1: Add a row to `digital/STATUS.md`**

In the "Core Systems" table (near `| Deck builder | ❌ | 4 hardcoded starter decks only |`), add a new row directly after it:

```markdown
| Debug panel | ✅ | Add card to hand, set/adjust Fuel (uncapped) and HQ, force objective control/level, force unit Suppress/Destroy/Reset, draw cards, skip to turn. Syncs online via the normal commitState/Firebase path. |
```

- [ ] **Step 2: Update `digital/DEVNOTES.md`**

Find the "Short version" bullet list (added when the implementation-status section was corrected). Add one line:

```markdown
- Debug panel (`js/debug.js` + wiring in `js/game.js`) is live — see `specs/2026-07-08-debug-panel-design.md` for full scope.
```

- [ ] **Step 3: Remove the now-superseded static mockup**

```bash
cd digital
git rm debug_panel_preview.html
```

- [ ] **Step 4: Commit**

```bash
cd digital
git add STATUS.md DEVNOTES.md
git commit -m "Document debug panel in STATUS/DEVNOTES, remove superseded static mockup"
```

---

## Manual follow-up (not automated in this plan)

Online-multiplayer sync for the debug panel is architecturally covered (every action routes through the existing `commitState()` → `pushStateIfOnline()` path, same as every other game action), but this plan's automated test only exercises local hotseat mode — matching the existing `selfplay_test.mjs` harness, which has the same limitation (see `digital/STATUS.md` and the 2026-07-07 session notes on the Artillery Position sync bug for why two-browser-context testing wasn't automated here either). Before relying on the panel during an actual online playtest session, do one manual check: open two browser tabs, create/join an online game, use the debug panel from one tab, and confirm the other tab's board/stats update to match.

---

## Self-Review

**Spec coverage:** every section of `digital/specs/2026-07-08-debug-panel-design.md` maps to a task — Access (Task 2-4), Add Card (Task 5), Fuel (Task 6), HQ (Task 7), Objective Control/Level (Task 8), Unit State incl. Reset (Task 9), Draw Cards (Task 10), Skip to Turn (Task 11), Architecture/sync (every task routes through `commitState`, verified end-to-end in Task 12).

**Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code.

**Type consistency:** `debugSetUnitState`'s third argument is the string `'normal' | 'suppressed' | 'destroyed'` throughout (Task 1's implementation and tests, Task 9's `applyDebugUnitState` calls) — consistent with the existing `BoardUnit.state` field documented in `digital/js/state.js`. `debugSetObjective`'s controller argument is `'p1' | 'p2' | 'neutral'` in the UI layer, translated to `'p1' | 'p2' | null` inside the function to match `Objective.controller`'s existing type — consistent between Task 1 and Task 8.
