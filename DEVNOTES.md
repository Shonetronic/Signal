# SIGNAL — Developer Notes

Quick orientation for anyone reading the code cold.

---

## File map

```
digital/
├── index.html          — lobby (Create Game / Join Game / Local Play)
├── game.html           — game screen HTML shell only (no logic)
├── package.json        — one script: npm run dev
│
├── js/
│   ├── game.js         — ALL game logic: event handlers, FSM, turn flow, objectives, missions
│   ├── state.js        — pure state functions (no DOM): endTurn, startOfTurn, applyHit, etc.
│   ├── combat.js       — attack resolution: getAttackableTargets, resolveSingleAttack
│   ├── cards.js        — card data array (CARDS) + CARD_BY_ID lookup map
│   ├── maps.js         — map terrain layouts + canPlaceOnTerrain
│   ├── ui.js           — DOM rendering: renderBoard, renderHand, renderHQ, appendLog
│   └── firebase.js     — Firebase read/write: pushState, subscribeState
│
└── css/
    └── game.css        — all styles
```

**The split that matters:** `state.js` / `combat.js` are pure functions with no DOM access — safe to unit test. `game.js` owns the DOM and the mutable `state` variable.

---

## State shape

```js
state = {
  turn: Number,
  initiative: 'p1' | 'p2',
  mapId: String,
  board: { "row,col": BoardUnit | null },   // e.g. "2,3"
  objectives: { "row,col": ObjectiveState },
  log: String[],
  p1: PlayerState,
  p2: PlayerState,
}

PlayerState = {
  hq: Number,           // starts 25, win condition
  fuel: Number,         // max 6, gain 3/turn
  hand: Number[],       // array of card IDs
  deck: Number[],       // remaining deck (top = index 0)
  missions: ActiveMission[],
  pendingFuelGain: Number,
  tempFuelDiscount: Number,
  overrun: Boolean,
  killsThisTurn: Number,
  totalKills: Number,
}

BoardUnit = {
  cardId: Number,
  owner: 'p1' | 'p2',
  state: 'normal' | 'suppressed' | 'destroyed',
  armorHits: Number,      // hits absorbed by armor so far
  tempKeywords: String[], // keywords granted this turn (Guard, Armor, etc.)
  tempSideBonus: Number,  // +N to all four sides this turn
  justPlaced: Boolean,    // cleared at end of turn
}
```

---

## UI state machine (game.js)

The variable `uiState` controls what a board click does:

| uiState | Board click behaviour |
|---|---|
| `"idle"` | Select a friendly unit → enter targeting |
| `"placing"` | Place the selected hand card on an empty tile |
| `"targeting"` | Resolve attack from `pendingAttackerKey` onto clicked enemy |
| `"command-targeting"` | Resolve targeted command (`pendingCommandId`) onto clicked tile |

`uiState` resets to `"idle"` after every resolved action and on every remote state receive.

---

## Turn flow

```
End Turn click
  → checkActiveMissions (endOfTurn) for current player
  → reset killsThisTurn
  → endTurn()           — swap initiative, clear tempKeywords/tempSideBonus/justPlaced
  → drawCards(1)        — new active player draws
  → startOfTurn()       — +3 fuel, decrement mission timers
  → updateObjectiveLevels()
  → checkObjectiveControl()
  → applyObjectiveEffects()
  → commitState()
```

---

## Firebase sync

Two functions in `firebase.js`:
- `pushState(gameId, state)` — writes the whole state to Firebase under the game ID
- `subscribeState(gameId, callback)` — fires callback on every remote write

**The array problem.** Firebase strips empty arrays and converts non-empty arrays to `{0: x, 1: y}` objects on retrieval. Every receive goes through `normalizeFirebaseState()` in `game.js`, which restores all arrays. If you add a new array field to state, add it to `normalizeFirebaseState` too or it will break in multiplayer.

**Echo filtering.** When P1 pushes state, Firebase also fires P1's own subscription. We filter this with `_pushId`: every push attaches a random ID, stored in `myLastPushId`. On receive, if `remoteState._pushId === myLastPushId` we skip it.

---

## Card IDs

Cards are identified by stable numeric IDs throughout the codebase. `CARD_BY_ID` in `cards.js` is a `Map<number, Card>` built from the `CARDS` array. The card list CSV in the parent folder is the source of truth for design; `cards.js` is the coded version.

Card types: `"unit"` | `"command"` | `"mission"` | `"objective"`.

---

## Keywords

Keywords live in two places per unit:
- `card.keyword` — base keyword from the card definition (one per card max)
- `unit.tempKeywords[]` — keywords granted this turn (cleared at `endTurn`)

Always use `getKeywords(unit)` from `state.js` — it merges both.

---

## Hit sequence

```
applyHit(unit) in state.js:

No armor:    normal → suppressed (1 HQ dmg) → destroyed (2 HQ dmg)
Armor:       normal → normal (armor absorbs) → suppressed → destroyed
Heavy Armor: normal → normal → normal → suppressed → destroyed
```

HQ damage is returned from `applyHit` and from `resolveSingleAttack`. Callers apply it to `state.p1.hq` / `state.p2.hq`.

---

## Known gaps (not yet implemented)

See `CLAUDE.md` section "Digital prototype — implementation status" for the full list. Short version (verified against code 2026-07-07):

- Bridge, Radar Station, Airfield L1 objective effects still need targeting UI (log-only, manual resolution)
- Coordinated Strike, Pincer Maneuver commands still need multi-select UI (no logic at all)
- Inspire, Breakthrough keywords are data tags only, no behavior wired
- Missions: full system is live, including Factory L2 Tank discount and Forward Observer's deck-order modal
- Deck builder: currently 4 hardcoded starter decks
- GitHub Pages deploy: live, no local server needed
- Debug panel (`js/debug.js` + wiring in `js/game.js`) is live — see `specs/2026-07-08-debug-panel-design.md` for full scope.
