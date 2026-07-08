# Debug Panel — Design Spec

Date: 2026-07-08
Status: Approved, pending implementation plan

## Purpose

Manual playtesting currently requires playing a full game to reach a specific board/HQ/Fuel state
to test a single card or bug. This panel lets a tester jump straight to that state.

## Access

- Always-visible "DEBUG" button, fixed bottom-right corner of the game screen.
- Click toggles a collapsible panel open/closed. No hidden shortcut or URL flag — the entry point
  is visible at all times, but the panel itself stays out of the way until opened.
- Visible on both local hotseat and online play, including the public GitHub Pages build.

## Scope

A player selector (P1 / P2 toggle) sits at the top of the panel and applies to every section
below except Objective Control and Unit State, which target whatever tile/unit is clicked
directly.

### 1. Add Card
Search-by-name input, filters across all cards in `CARD_BY_ID`. Selecting a result adds that
`cardId` to the selected player's hand. No Fuel cost, no deck interaction.

### 2. Fuel
- Number input + "Set" button — sets Fuel to an exact value for the selected player.
- Quick +1 / −1 / +5 / −5 buttons for fast nudges from the current value.
- Uncapped — may exceed the normal 6 Fuel storage limit (unlike normal gameplay, where only
  Industrial Surge's bonus is allowed to exceed the cap).

### 3. HQ Health
- Number input + "Set" button, plus +1 / −1 / +5 / −5 buttons, same pattern as Fuel.
- Floored at 0 (0 or below triggers the normal win condition — that's expected, not blocked).
- No ceiling enforced.

### 4. Objective Control / Level
Dropdown of the 1-2 objectives currently placed on the board (there are never more than 2 per
`pickObjectives`). Set controller (P1 / P2 / Neutral, where Neutral maps to `controller: null` in
state, matching what `checkObjectiveControl` produces for a contested tile) and level (1-4),
apply instantly.

### 5. Unit State
Click a unit already on the board, then choose: Suppress / Destroy / Reset to Normal. Reset
undoes a Suppress or Destroy for further testing without needing to restart.

### 6. Draw Cards
Number input (N) + "Draw" button — draws N cards from the selected player's deck to their hand.
Uses the existing `drawCards()` helper, so it naturally stops if the deck runs out.

### 7. Skip to Turn
Number input + "Jump" button. Sets `state.turn` directly, then re-runs `updateObjectiveLevels`
and `checkObjectiveControl` so objective escalation reflects the new turn number correctly
(objective level is a pure function of turn number, not cumulative).

**Explicit non-goal:** this does NOT simulate the turns being skipped over — no fuel gains, no
draws, no mission-timer decrements for the "skipped" turns. It only fast-forwards the
turn-number-driven state (objective levels/control). Anything else must be set explicitly via the
other panel sections.

## Architecture

- Every debug action builds a new `GameState` and calls the existing `commitState()` — the same
  function normal game actions already use (`digital/js/game.js`). Since `commitState` already
  calls `pushStateIfOnline()`, multiplayer sync via Firebase comes for free — no separate sync
  path needed for the debug panel.
- Every debug action appends a `[DEBUG] ...` line to the game log, so a hand-edited state is
  visibly auditable afterward (easy to forget mid-test that a value was manually set).
- Debug actions bypass the normal `isOnline && state.initiative !== myRole` turn gate used by
  regular board/hand clicks — the panel must be able to affect either player regardless of whose
  turn it currently is (per the "either player" requirement above).

## Out of scope for v1

Anything not listed above (e.g. editing raw JSON state, forcing terrain, editing deck contents
directly, mission manipulation beyond what Skip to Turn covers). Add later if a concrete testing
need comes up — no need to build ahead of that.
