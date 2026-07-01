# SIGNAL Digital Prototype — Living Architecture Doc

**Purpose:** Every subagent reads this before starting a task and updates it after completing one. This is the single source of truth for how the codebase is structured. The DEVPLAN tells you *what* to build; this doc tells you *how* things are built so far.

**Rule:** If you write code that contradicts something in this doc, update this doc. If something here is wrong, fix it here. Never silently drift.

---

## Session Log

| Session | Date | What changed |
|---|---|---|
| 1 | 2026-07-01 | Created digital/ subfolder, DEVPLAN.md, ARCHITECTURE.md, cards.js |
| 2 | 2026-07-01 | Created state.js — game state model and pure transition functions |
| 3 | 2026-07-01 | Created combat.js — resolveDeployment, adjacentTiles, Bombard targeting |
| 4 | 2026-07-01 | Created game.html, game.css, ui.js — board UI, hand display, placement and combat flow |
| 5 | 2026-07-01 | Fixed combat mechanic — single-target attacks, targeting UI state machine, destroyed units removed from board |
| 6 | 2026-07-01 | Google Sheet "SIGNAL — Deck Builder & Config" (ID: 1uYwR8_s8P1iSupFgEHEVG2MCXD4tc8Zjz1gei5TO1Us): ROSTER (74 cards), CONFIG (game params), DECK_Aggro/Control/Power (25-slot VLOOKUP tabs + starter decks) |
| 7 | 2026-07-01 | Deck selection lobby screen — 3 starter decks (Blitzkrieg/Defensive Line/Iron Fist), P1 then P2 each pick before game starts; game state initialized with chosen deck IDs |
| 8 | 2026-07-01 | Map selection + terrain — maps.js with 5 maps (Normandy/Stalingrad/El Alamein/Ardennes/Kursk); terrain rules: Forest=no Tanks, Water=Naval+Aircraft+Airborne only; objectives placed randomly from pool at game start |
| 9 | 2026-07-01 | Objective control + effects — majority-adjacent rule (checkObjectiveControl in state.js), effects applied at start of each turn (applyObjectiveEffects in game.html), hover tooltip shows all 4 levels with current highlighted |

---

## Module Map

| File | Exports | Depends on |
|---|---|---|
| `js/cards.js` | `CARDS`, `CARD_BY_ID` | nothing |
| `js/maps.js` | `MAPS`, `getTerrain`, `canPlaceOnTerrain` | nothing |
| `js/state.js` | see State API below | `cards.js` |
| `js/combat.js` | see Combat API below | `cards.js`, `state.js` |
| `js/ui.js` | see UI API below | `cards.js`, `state.js`, `maps.js` |
| `js/firebase.js` | see Firebase API below | Firebase SDK (CDN) |
| `js/lobby.js` | (side-effects only) | `firebase.js`, `state.js` |
| `game.html` | (entry point) | all of the above |
| `index.html` | (entry point) | `lobby.js` |

**Dependency rule:** `cards.js` and `state.js` must never import from `ui.js`, `firebase.js`, or `lobby.js`. The dependency graph flows one way: cards → state → combat/ui → firebase → entry points.

---

## State Shape

This is the canonical game state object. Firebase stores this exact shape. Do not add fields without updating this doc.

```js
{
  turn: number,               // starts at 1, increments on endTurn
  initiative: "p1" | "p2",   // whose turn it is
  phase: "play",              // reserved for future phases; always "play" for now
  p2Joined: boolean,          // set by lobby when opponent joins; not game logic
  mapId: string,              // key into MAPS in maps.js — determines terrain layout

  p1: PlayerState,
  p2: PlayerState,

  board: {
    "0,0": BoardUnit | null,
    "0,1": BoardUnit | null,
    // ... all 16 tiles, keys are "row,col" strings
    "3,3": BoardUnit | null,
  },

  objectives: {
    "row,col": { cardId: number, level: number },
    // only tiles that have an objective card placed on them
  },

  log: string[],   // last N action strings, appended by commitState
}
```

### PlayerState

```js
{
  hq: number,                // HQ HP, starts 20, game ends at 0
  fuel: number,              // current fuel, max 6
  pendingFuelGain: number,   // delayed fuel (Industrial Surge), added at next startOfTurn
  hand: number[],            // cardIds in hand, order matters for display
  deck: number[],            // cardIds remaining, index 0 = top of deck
  missions: ActiveMission[], // active mission cards
  tempFuelDiscount: number,  // discount on next card of matching class (Armored Spearhead)
}
```

### ActiveMission

```js
{
  cardId: number,
  turnsRemaining: number,
  progress: any,   // mission-specific tracking; structure varies by card
}
```

### BoardUnit

```js
{
  cardId: number,
  owner: "p1" | "p2",
  state: "normal" | "suppressed" | "destroyed",
  armorHits: number,       // hits absorbed by armor so far (0 until armor starts taking hits)
  tempKeywords: string[],  // keywords added this turn only (Smoke Screen, Dig In, etc.)
  tempSideBonus: number,   // +N to all sides this turn (Rally Cry, City objective, etc.)
  justPlaced: boolean,     // true only on the turn deployed; cleared by endTurn
}
```

---

## State API (`js/state.js`)

All functions are **pure** — they return new state, never mutate in place.

```js
createInitialState(p1DeckIds: number[], p2DeckIds: number[]) → GameState
// Shuffles decks, deals 5 cards to each hand, sets hq=20, fuel=0.

startOfTurn(state: GameState) → GameState
// Active player gains 3 fuel (+pendingFuelGain, capped at 6).
// Resets pendingFuelGain to 0.
// Decrements mission turnsRemaining, removes expired missions.

endTurn(state: GameState) → GameState
// Swaps initiative, increments turn counter.
// Clears justPlaced, tempKeywords, tempSideBonus on all board units.

updateObjectiveLevels(state: GameState) → GameState
// Recalculates objective level for current turn and sets it on all placed objectives.

drawCards(playerState: PlayerState, n: number) → PlayerState
// Draws up to n cards from deck into hand. Stops if deck empty.

spendFuel(playerState: PlayerState, amount: number) → PlayerState
gainFuel(playerState: PlayerState, amount: number) → PlayerState

getSideValue(boardUnit: BoardUnit, dir: "n"|"e"|"s"|"w") → number
// Returns card's base side value + tempSideBonus.

getKeywords(boardUnit: BoardUnit) → string[]
// Returns card's base keyword (if any) + tempKeywords array.

maxArmorHits(boardUnit: BoardUnit) → number
// Heavy Armor → 2, Armor → 1, else → 0.

hitsToDestroy(boardUnit: BoardUnit) → number
// maxArmorHits + 2 (armor absorbs N hits, then Suppressed, then Destroyed).

applyHit(boardUnit: BoardUnit) → { newUnit: BoardUnit, hqDamage: number }
// Applies one hit following the sequence:
//   armorHits < maxArmorHits → absorb (hqDamage = 0, state unchanged)
//   state === "normal"       → "suppressed" (hqDamage = 1)
//   state === "suppressed"   → "destroyed"  (hqDamage = 2)
// hqDamage is dealt to the unit owner's HQ (the one being attacked).

attackBeats(attacker: BoardUnit, attDir: "n"|"e"|"s"|"w", defender: BoardUnit) → boolean
// Compares attacker's side value vs defender's opposite side. Tie = attacker wins.
// attDir is the direction the attacker is swinging FROM (e.g. attacker is N of defender → attDir = "s").

oppositeDir(dir: "n"|"e"|"s"|"w") → "n"|"e"|"s"|"w"

objectiveLevel(turn: number) → 0|1|2|3|4
// turn 1 → 0 (no bonus), turns 2-3 → 1, 4-5 → 2, 6-7 → 3, 8+ → 4.
```

---

## Turn Structure (locked)

On your turn:
1. Gain 3 fuel (startOfTurn)
2. Play cards from hand and/or attack with board units — in any order, as many times as you have fuel/targets
3. **Placing a unit** → immediately enter targeting mode: player must click 1 adjacent enemy to attack (or cancel, which returns the card to hand and refunds fuel)
4. **Existing alive units** (state === "normal") can each attack once per turn — click the unit, then click 1 adjacent enemy
5. **Suppressed units** cannot attack but still occupy their tile and count for objectives
6. **Destroyed units** are removed from the board immediately (tile becomes null, free for new placement)
7. End Turn

## Combat API (`js/combat.js`)

```js
tileKey(row: number, col: number) → string         // "row,col"
tileCoords(key: string) → [number, number]          // [row, col]
adjacentTiles(row, col) → { key: string, dir: string }[]
// Returns tiles orthogonally adjacent to (row,col) that are within the 4x4 grid.

getAttackableTargets(state: GameState, attackerKey: string) → { key: string, dir: string }[]
// Returns adjacent enemy tiles the attacker can legally target.
// Filters out: friendly units, empty tiles, destroyed units.
// Guard enforcement: if any adjacent enemy has Guard (and is not Suppressed),
//   only Guard units are returned — attacker must target them first.

resolveSingleAttack(state: GameState, attackerKey: string, targetKey: string)
  → { boardMutations, hqDamageToP1, hqDamageToP2, logEntries }
// Resolves one unit attacking one specific target.
// boardMutations: array of { key: string, newUnit: BoardUnit } — may include
//   newUnit = null if the defender was Destroyed (removes it from board).
// hqDamageToP1/P2: HQ damage from this single attack.
// logEntries: human-readable strings.
// If attack fails (attacker value < defender value, or Guard blocks), returns
//   empty mutations and 0 damage — failed attack has no penalty.
// Caller applies mutations and deducts HQ damage.
```

**`resolveDeployment` is removed** — replaced by `resolveSingleAttack`. Placement no longer auto-hits all adjacents; the player picks 1 target via the UI targeting mode.

---

## UI API (`js/ui.js`)

```js
renderBoard(state: GameState, selectedTileKey: string|null, validDropKeys: Set<string>|null) → void
// Writes into #board element. Highlights selectedTileKey, marks validDropKeys green.

renderHand(handCardIds: number[], containerId: string, selectedCardId: number|null) → void
// Writes into element with given id. Marks selectedCardId as selected.

renderHQ(state: GameState) → void
// Updates #p1-hq, #p2-hq, #p1-fuel, #p2-fuel, #turn-display text content.

appendLog(entries: string[]) → void
// Appends strings to #game-log and scrolls to bottom.
```

**DOM contract:** `game.html` must contain these element IDs: `board`, `p1-hand`, `p1-hq`, `p2-hq`, `p1-fuel`, `p2-fuel`, `turn-display`, `game-log`. Do not rename them.

---

## Firebase API (`js/firebase.js`)

```js
pushState(gameId: string, state: GameState) → Promise<void>
// Writes full state to Firebase at path games/{gameId}.

fetchState(gameId: string) → Promise<GameState | null>
// One-time read. Returns null if game doesn't exist.

subscribeState(gameId: string, callback: (state: GameState) => void) → () => void
// Real-time listener. Returns unsubscribe function.

generateGameCode() → string
// Returns a random 6-character uppercase alphanumeric string.
```

**Firebase path convention:** All game data lives at `games/{gameId}`. Never write to any other path.

---

## Keyword Resolution Decisions

These are locked decisions — don't reinvent them.

| Keyword | How it resolves |
|---|---|
| **Guard** | UI enforces targeting: if a Guard unit is adjacent to the attacker, it must be the target. Guard is ignored if the unit is Suppressed. `resolveDeployment` trusts the caller passed a legal target. |
| **Armor** | Absorbs 1 hit before state changes. Tracked via `armorHits` on BoardUnit. `applyHit` handles this. |
| **Heavy Armor** | Absorbs 2 hits. Same mechanism as Armor, `maxArmorHits` returns 2. |
| **Bombard** | Unit attacks a tile 2 steps in its strongest-value direction, not adjacent tiles. Implemented in `buildAttackList` inside combat.js. |
| **Double Attack** | Unit attacks all adjacent enemies (same as default but keyword is present for card display). In v1, "all adjacent" is the default anyway — Double Attack becomes meaningful once we add a "choose 1 target" mode. |
| **Breakthrough** | After Destroying an enemy, unit can slide into the vacated tile and attack again. **Deferred — not implemented in Phase 1.** For now, Breakthrough is a stat card with no special mechanic. |
| **Airborne** | Ignores terrain restrictions. **Terrain not implemented in Phase 1**, so Airborne has no mechanical effect yet. Card still shows keyword. |
| **Inspire** | Adjacent friendly units gain +1 to all sides. **Deferred — not implemented in Phase 1.** Requires tracking adjacency every time a unit moves or is placed. |

---

## Patterns

### Immutability
All state transitions return new objects. Never do `state.p1.hq -= 1`. Always do `{ ...state, p1: { ...state.p1, hq: state.p1.hq - 1 } }`.

### Committing a move (game.html)
```js
async function commitState(newState, logLines) {
  state = newState;
  appendLog(logLines || []);
  redraw();
  if (isOnline) await pushState(gameId, state);
}
```
Every action goes through `commitState`. Never write to `state` directly and then call `redraw()` separately.

### Tile keys
Always `"row,col"` strings. Row 0 is top, row 3 is bottom. Column 0 is left, column 3 is right. Never use any other format.

### HQ damage direction
`hqDamageToP1` means damage dealt TO P1's HQ (i.e. P2 attacked P1's unit). `hqDamageToP2` means damage dealt TO P2's HQ.

---

## Deferred — Do Not Implement Yet

The following are intentionally out of scope for Phase 1–2. If you're a subagent and a task description doesn't mention these, leave them alone:

- Interactive Command/Mission effects (Field Medic target selection, Tactical Withdrawal, etc.)
- Guard targeting enforcement in UI
- Breakthrough chain movement
- Inspire adjacency bonus
- Map orientation (flip/rotate — agreed pre-game in physical version, skipped in prototype)
- Deck builder (card-by-card picker, 50 AP budget)
- Win condition popup/screen
- Copy limits (Common max 2, Rare max 1) — relevant only in deck builder
