# SIGNAL Digital Prototype — Implementation Plan

**Goal:** Build a playable 2-player online prototype of the SIGNAL WWII card game using vanilla HTML/JS and Firebase Realtime Database, hosted free on GitHub Pages — no server, no build tools, no npm.

**Architecture:** All game state lives in a single Firebase JSON document shared between two browsers. When a player takes an action, they write to Firebase; the opponent's browser listens and re-renders. Card rendering is adapted from the existing `print_cards.html`. Game logic runs entirely client-side.

**Tech Stack:** HTML5 + vanilla JS (ES modules via `<script type="module">`) · Firebase Realtime Database (free tier, CDN import) · GitHub Pages (free static hosting)

**What you need before starting:**
- GitHub account (free) — github.com
- Firebase account (free) — firebase.google.com
- Git installed — git-scm.com/downloads
- VS Code (already have it)

**Scope note:** This is split into 3 phases. Each phase ends with something testable. Don't start Phase 2 until Phase 1 plays locally.

---

## Subagent Execution Plan

Each task is dispatched to a fresh subagent. Don't run tasks in parallel — each one modifies files the next task depends on.

| Task | What it does | Model | Why |
|---|---|---|---|
| 1 — Card data | Transcribe 83 cards into `cards.js` | **Haiku** | Pure data copy, no reasoning needed |
| 2 — State model | Write `state.js` pure functions | **Sonnet** | Logic needs to be correct, spec is clear |
| 3 — Combat engine | Write `combat.js` hit resolution | **Sonnet** | Multiple interacting rules, needs care |
| 4 — Board UI | Write `game.html`, `game.css`, `ui.js` | **Sonnet** | CSS + JS wiring, moderate complexity |
| 5 — Firebase docs | Write `FIREBASE_SETUP.md` | **Haiku** | Documentation only |
| 6 — Firebase sync | Write `firebase.js` | **Sonnet** | Integration code, needs to match state shape |
| 7 — Lobby | Write `index.html`, `lobby.css`, `lobby.js` | **Sonnet** | UI + Firebase wiring |
| 8 — Objectives | Add escalation to `state.js` + `game.html` | **Haiku** | Small addition, fully specified |
| 9 — Deploy | Git init, GitHub Pages setup | **Haiku** | Config steps, no real code |

**When to escalate to Opus:** Only if Sonnet produces combat bugs that are hard to diagnose (keyword interactions with multiple simultaneous state mutations). Escalate that specific debug session, not the whole plan.

**How to dispatch:** Tell Claude "execute Task N from the DEVPLAN" and it will spawn a subagent with the right model. Review the output before moving to the next task.

**Architecture rule:** Every subagent must read `digital/ARCHITECTURE.md` before writing any code, and update the Session Log + any changed sections (state shape, function signatures, keyword decisions) after completing its task. This prevents drift across sessions.

---

## File Structure

```
digital/
├── index.html          — lobby: create or join a game by 6-digit code
├── game.html           — the actual game board (2-player view)
├── css/
│   ├── lobby.css       — lobby styles
│   └── game.css        — board, hand, HQ display styles
├── js/
│   ├── cards.js        — all card data (all 83 cards, one source of truth)
│   ├── state.js        — game state model + pure transition functions
│   ├── combat.js       — combat resolution: side values, hit sequences, keywords
│   ├── ui.js           — renders board/hand/HQ from state object
│   ├── firebase.js     — Firebase read/write wrapper (thin layer over SDK)
│   └── lobby.js        — create/join game, redirect to game.html
├── DEVPLAN.md          — this file
└── FIREBASE_SETUP.md   — Firebase config instructions (fill in after account setup)
```

Each file has one job. `state.js` has zero DOM code. `ui.js` has zero game logic. `firebase.js` has zero rendering. This separation means you can test logic without a browser and fix UI without touching rules.

---

## Phase 1: Local Solo Sandbox (Sessions 1–3)

Goal: one browser, two sides visible side by side, full combat resolving. No network yet.

---

### Task 1: Card Data

**Files:**
- Create: `digital/js/cards.js`

This is the single source of truth for all card data. Extracted and expanded from `print_cards.html` + `card_list.csv` (the CSV is authoritative for the 27 new [NEW] cards not yet in the print HTML).

- [ ] **Step 1: Create `digital/js/cards.js`**

```js
// All 83 cards. Each card has a stable numeric id.
// Units: { id, name, cls, rarity, type:"unit", cost, ap, keyword, n, e, s, w, ability }
// Commands: { id, name, rarity, type:"command", cost, ap, effect }
// Missions: { id, name, rarity, type:"mission", cost, ap, req, reward, limitTurns }
// Objectives: { id, name, type:"objective", category, l1, l2, l3, l4 }

export const CARDS = [
  // ── UNITS ──────────────────────────────────────────────────────────────
  { id:1,  name:"Rifle Squad",         cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:1,  keyword:null,           n:4, e:3, s:4, w:3, ability:null },
  { id:2,  name:"Riflemen",            cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:1,  keyword:"Guard",         n:4, e:3, s:2, w:3, ability:null },
  { id:3,  name:"Fallschirmjäger",     cls:"Infantry",  rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Airborne",      n:5, e:5, s:2, w:2, ability:null },
  { id:4,  name:"Mortar Team",         cls:"Infantry",  rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Bombard",       n:5, e:2, s:4, w:2, ability:null },
  { id:5,  name:"Supply Runner",       cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:2,  keyword:null,           n:3, e:3, s:3, w:3, ability:"Control objective at turn end → gain 1 Fuel." },
  { id:6,  name:"Halftrack",           cls:"Tank",      rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Armor",         n:5, e:4, s:1, w:4, ability:null },
  { id:7,  name:"Blitz Tank",          cls:"Tank",      rarity:"Common", type:"unit", cost:3, ap:4,  keyword:"Breakthrough",  n:5, e:5, s:5, w:5, ability:null },
  { id:8,  name:"Tank Hunter",         cls:"Tank",      rarity:"Common", type:"unit", cost:3, ap:3,  keyword:"Double Attack", n:6, e:6, s:3, w:2, ability:null },
  { id:9,  name:"Heavy Tank",          cls:"Tank",      rarity:"Common", type:"unit", cost:4, ap:4,  keyword:"Heavy Armor",   n:5, e:4, s:4, w:4, ability:null },
  { id:10, name:"Field Howitzer",      cls:"Artillery", rarity:"Common", type:"unit", cost:2, ap:1,  keyword:"Bombard",       n:4, e:3, s:4, w:3, ability:null },
  { id:11, name:"Anti-Tank Gun",       cls:"Artillery", rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Guard",         n:2, e:6, s:2, w:6, ability:null },
  { id:12, name:"Fighter",             cls:"Aircraft",  rarity:"Common", type:"unit", cost:3, ap:3,  keyword:"Airborne",      n:7, e:6, s:5, w:1, ability:null },
  { id:13, name:"Dive Bomber",         cls:"Aircraft",  rarity:"Common", type:"unit", cost:3, ap:4,  keyword:"Double Attack", n:7, e:1, s:7, w:2, ability:null },
  { id:14, name:"Field Commander",     cls:"Commander", rarity:"Rare",   type:"unit", cost:4, ap:4,  keyword:"Inspire",       n:6, e:6, s:6, w:6, ability:null },
  { id:15, name:"River Gunboat",       cls:"Naval",     rarity:"Common", type:"unit", cost:2, ap:1,  keyword:"Bombard",       n:2, e:5, s:2, w:5, ability:null },
  { id:34, name:"Scouts",              cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:1,  keyword:null,           n:5, e:5, s:1, w:1, ability:null },
  { id:35, name:"Mountain Troops",     cls:"Infantry",  rarity:"Common", type:"unit", cost:2, ap:2,  keyword:null,           n:4, e:5, s:4, w:5, ability:null },
  { id:36, name:"Heavy Machine Gun Team", cls:"Infantry", rarity:"Common", type:"unit", cost:2, ap:2, keyword:"Guard",        n:6, e:2, s:6, w:2, ability:null },
  { id:37, name:"Paratrooper Veterans",cls:"Infantry",  rarity:"Common", type:"unit", cost:3, ap:3,  keyword:"Airborne",      n:5, e:5, s:2, w:6, ability:null },
  { id:38, name:"Panzer II",           cls:"Tank",      rarity:"Common", type:"unit", cost:1, ap:1,  keyword:null,           n:5, e:2, s:5, w:2, ability:null },
  { id:39, name:"Sherman Tank",        cls:"Tank",      rarity:"Common", type:"unit", cost:3, ap:3,  keyword:"Armor",         n:7, e:6, s:4, w:1, ability:null },
  { id:40, name:"Flak Halftrack",      cls:"Tank",      rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Bombard",       n:6, e:5, s:2, w:1, ability:null },
  { id:41, name:"Tank Destroyer",      cls:"Tank",      rarity:"Common", type:"unit", cost:4, ap:4,  keyword:"Breakthrough",  n:9, e:3, s:9, w:3, ability:null },
  { id:42, name:"Rocket Launcher",     cls:"Artillery", rarity:"Common", type:"unit", cost:3, ap:4,  keyword:"Bombard",       n:5, e:1, s:1, w:1, ability:null },
  { id:43, name:"Anti-Aircraft Gun",   cls:"Artillery", rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Guard",         n:6, e:5, s:4, w:1, ability:null },
  { id:44, name:"Recon Plane",         cls:"Aircraft",  rarity:"Common", type:"unit", cost:2, ap:3,  keyword:"Airborne",      n:6, e:4, s:4, w:1, ability:null },
  { id:45, name:"Heavy Bomber",        cls:"Aircraft",  rarity:"Common", type:"unit", cost:4, ap:5,  keyword:"Bombard",       n:6, e:6, s:6, w:6, ability:null },
  { id:46, name:"Landing Craft",       cls:"Naval",     rarity:"Common", type:"unit", cost:1, ap:1,  keyword:null,           n:7, e:4, s:2, w:1, ability:null },
  { id:47, name:"Destroyer",           cls:"Naval",     rarity:"Common", type:"unit", cost:3, ap:2,  keyword:"Armor",         n:8, e:1, s:8, w:1, ability:null },
  { id:48, name:"Ace Pilot",           cls:"Aircraft",  rarity:"Common", type:"unit", cost:4, ap:4,  keyword:"Double Attack", n:8, e:8, s:3, w:3, ability:null },
  { id:59, name:"Storm Squad",         cls:"Infantry",  rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Double Attack", n:4, e:1, s:5, w:3, ability:null },
  { id:60, name:"Vanguard Tank",       cls:"Tank",      rarity:"Common", type:"unit", cost:2, ap:2,  keyword:"Breakthrough",  n:6, e:5, s:4, w:1, ability:null },
  { id:61, name:"Shock Troopers",      cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:1,  keyword:"Double Attack", n:3, e:2, s:3, w:2, ability:null },
  { id:62, name:"Bunker Crew",         cls:"Infantry",  rarity:"Common", type:"unit", cost:3, ap:2,  keyword:"Guard",         n:7, e:2, s:7, w:2, ability:null },
  { id:63, name:"Self-Propelled Gun",  cls:"Artillery", rarity:"Common", type:"unit", cost:3, ap:3,  keyword:"Armor",         n:9, e:1, s:1, w:4, ability:null },
  { id:64, name:"Veteran Garrison",    cls:"Infantry",  rarity:"Common", type:"unit", cost:4, ap:4,  keyword:"Guard",         n:7, e:6, s:7, w:4, ability:null },
  { id:65, name:"Panzer Brigade",      cls:"Tank",      rarity:"Common", type:"unit", cost:3, ap:3,  keyword:"Heavy Armor",   n:5, e:4, s:2, w:2, ability:null },
  { id:66, name:"King Tiger",          cls:"Tank",      rarity:"Rare",   type:"unit", cost:5, ap:4,  keyword:"Heavy Armor",   n:4, e:7, s:6, w:6, ability:null },
  { id:67, name:"Battleship",          cls:"Naval",     rarity:"Common", type:"unit", cost:4, ap:3,  keyword:"Heavy Armor",   n:5, e:5, s:5, w:1, ability:null },
  { id:68, name:"Chief of Staff",      cls:"Commander", rarity:"Rare",   type:"unit", cost:3, ap:3,  keyword:"Inspire",       n:1, e:8, s:6, w:1, ability:null },
  { id:69, name:"Quartermaster",       cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:1,  keyword:null,           n:1, e:1, s:4, w:4, ability:"Start of your turn: if you control 2+ objectives, draw a card." },
  { id:70, name:"Trench Runners",      cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:1,  keyword:null,           n:4, e:1, s:6, w:1, ability:null },
  { id:71, name:"Light Skirmishers",   cls:"Infantry",  rarity:"Common", type:"unit", cost:1, ap:1,  keyword:null,           n:1, e:5, s:2, w:5, ability:null },
  { id:72, name:"Reserve Infantry",    cls:"Infantry",  rarity:"Common", type:"unit", cost:2, ap:2,  keyword:null,           n:1, e:6, s:5, w:6, ability:null },
  { id:86, name:"Grenadiers",          cls:"Infantry",  rarity:"Common", type:"unit", cost:3, ap:3,  keyword:null,           n:6, e:6, s:6, w:6, ability:null },

  // ── COMMANDS ───────────────────────────────────────────────────────────
  { id:16, name:"Artillery Barrage",   rarity:"Common", type:"command", cost:2, ap:1, effect:"Remove Armor from 1 enemy unit and Suppress it." },
  { id:17, name:"Blitzkrieg Order",    rarity:"Common", type:"command", cost:2, ap:2, effect:"Choose 1 friendly Tank. It may attack 1 adjacent enemy immediately, as if just deployed." },
  { id:18, name:"Field Medic",         rarity:"Common", type:"command", cost:1, ap:1, effect:"Remove Suppression from 1 friendly unit." },
  { id:19, name:"Tactical Withdrawal", rarity:"Common", type:"command", cost:1, ap:1, effect:"Return 1 friendly unit to your hand. It loses Suppression. Draw 1 card." },
  { id:20, name:"Air Strike",          rarity:"Common", type:"command", cost:3, ap:3, effect:"Deal 1 hit to a single enemy unit for each friendly Aircraft you control." },
  { id:21, name:"Coordinated Strike",  rarity:"Common", type:"command", cost:2, ap:2, effect:"Choose 2 friendly units. Each may attack 1 adjacent enemy this turn." },
  { id:22, name:"Recon",               rarity:"Common", type:"command", cost:2, ap:1, effect:"Draw 3 cards." },
  { id:49, name:"Smoke Screen",        rarity:"Common", type:"command", cost:1, ap:1, effect:"Choose 1 friendly unit. It gains Guard until your next turn." },
  { id:50, name:"Improvised Position", rarity:"Common", type:"command", cost:1, ap:1, effect:"Choose 1 friendly vanilla unit. It gains Armor until your next turn." },
  { id:51, name:"Rally Cry",           rarity:"Common", type:"command", cost:1, ap:1, effect:"Choose up to 2 friendly units. Each gains +1 to all sides until your next turn." },
  { id:52, name:"Forward Observer",    rarity:"Common", type:"command", cost:1, ap:1, effect:"Draw 3 cards. Put 1 on top of your deck and 1 on the bottom. Keep 1." },
  { id:53, name:"Pincer Maneuver",     rarity:"Common", type:"command", cost:3, ap:1, effect:"Choose 2 friendly units on opposite sides of 1 enemy unit. Both attack it." },
  { id:54, name:"Last Stand",          rarity:"Common", type:"command", cost:2, ap:1, effect:"Remove Suppression from 1 friendly unit. It gains Guard until your next turn." },
  { id:73, name:"Overrun",             rarity:"Common", type:"command", cost:2, ap:2, effect:"This turn, every time you Suppress or Destroy an enemy unit, deal 1 additional HQ damage." },
  { id:74, name:"Dig In",              rarity:"Common", type:"command", cost:1, ap:1, effect:"Choose 1 friendly unit on an objective tile you control. It gains Guard and Armor until your next turn." },
  { id:75, name:"Hold Position",       rarity:"Common", type:"command", cost:2, ap:1, effect:"Up to 2 friendly units adjacent to an objective you control gain Armor until your next turn." },
  { id:76, name:"Industrial Surge",    rarity:"Common", type:"command", cost:1, ap:1, effect:"At the start of your next turn, gain 2 Fuel." },
  { id:78, name:"Combined Arms Doctrine", rarity:"Common", type:"command", cost:3, ap:3, effect:"Remove Suppression from all units on the board. For each unit cleared this way, your HQ gains 2 HP." },
  { id:79, name:"Suppressing Fire",    rarity:"Common", type:"command", cost:4, ap:4, effect:"Deal 1 hit to a single enemy unit for each friendly Infantry you control." },
  { id:80, name:"Entrench",            rarity:"Common", type:"command", cost:2, ap:2, effect:"Friendly Infantry you control gain +2 to all sides until your next turn." },

  // ── MISSIONS ───────────────────────────────────────────────────────────
  { id:23, name:"Hold the Line",       rarity:"Common", type:"mission", cost:0, ap:0, req:"Control all objectives at end of your turn.",                                          reward:"Heal 5 HQ HP.",                          limitTurns:5 },
  { id:24, name:"Deep Strike",         rarity:"Common", type:"mission", cost:1, ap:2, req:"Have a friendly unit adjacent to 2+ enemy units simultaneously.",                      reward:"Deal 2 HQ damage.",                      limitTurns:3 },
  { id:25, name:"Blitz Assault",       rarity:"Common", type:"mission", cost:0, ap:0, req:"Destroy 2 enemy units in a single turn.",                                              reward:"Draw 2 cards and gain 1 Fuel.",          limitTurns:4 },
  { id:55, name:"Armored Spearhead",   rarity:"Common", type:"mission", cost:1, ap:2, req:"Play.",                                                                                reward:"Your next Tank costs 2 less Fuel.",      limitTurns:0 },
  { id:56, name:"Total Air Superiority",rarity:"Common", type:"mission", cost:1, ap:2, req:"Destroy an enemy unit with a friendly Aircraft.",                                    reward:"Deal 2 HQ damage.",                      limitTurns:4 },
  { id:57, name:"Fortify the Line",    rarity:"Common", type:"mission", cost:1, ap:1, req:"Control 2+ objectives at end of your turn.",                                           reward:"Remove Suppression from 1 friendly unit and give it Armor.", limitTurns:5 },
  { id:58, name:"Encirclement",        rarity:"Common", type:"mission", cost:1, ap:1, req:"A friendly unit is adjacent to 1 enemy unit on 2+ sides simultaneously.",              reward:"Deal 1 hit to that enemy unit.",         limitTurns:4 },
  { id:81, name:"Total Onslaught",     rarity:"Common", type:"mission", cost:1, ap:2, req:"Destroy 3 enemy units total this match.",                                              reward:"Deal 2 HQ damage.",                      limitTurns:6 },
  { id:84, name:"Overwhelming Force",  rarity:"Common", type:"mission", cost:1, ap:2, req:"Destroy an enemy unit with a friendly Heavy Armor unit.",                              reward:"Deal 2 HQ damage.",                      limitTurns:5 },

  // ── OBJECTIVES ─────────────────────────────────────────────────────────
  { id:26, name:"Factory",             type:"objective", category:"Economy/Vehicle",  l1:"Gain 1 Fuel.",                                         l2:"Gain 1 Fuel. Next Tank costs 1 less.",              l3:"Gain 2 Fuel. Tanks +1 all sides.",                    l4:"Gain 2 Fuel. Tanks +2 all sides. Deal 2 HQ damage." },
  { id:27, name:"Airfield",            type:"objective", category:"Air/Tempo",        l1:"Aircraft attack twice on placement this turn.",         l2:"Deal 1 HQ damage.",                                l3:"Deal 1 HQ damage. Draw 1 card.",                      l4:"Deal 4 HQ damage." },
  { id:28, name:"Supply Depot",        type:"objective", category:"Resource",          l1:"Gain 1 Fuel.",                                         l2:"Gain 2 Fuel.",                                     l3:"Gain 2 Fuel. Draw 1 card.",                           l4:"Gain 3 Fuel. Draw 1 card. Deal 2 HQ damage." },
  { id:29, name:"Bridge",              type:"objective", category:"Positioning",       l1:"Return 1 friendly unit to hand, remove Suppression.",  l2:"Same. Draw 1 card.",                               l3:"Return up to 2 units, remove Suppression.",           l4:"Return up to 2, remove Suppression. Draw 1 card. Deal 2 HQ damage." },
  { id:30, name:"Radar Station",       type:"objective", category:"Information",       l1:"Look at opponent's hand.",                             l2:"Look at hand. Draw 1 card.",                       l3:"Look; opponent discards 1 you choose.",                l4:"Look; opponent discards 1. Draw 1 card. Deal 2 HQ damage." },
  { id:31, name:"City",                type:"objective", category:"Infantry/Defense",  l1:"Adjacent Infantry gain Guard this turn.",               l2:"Adjacent Infantry +1 all sides this turn.",        l3:"Adjacent Infantry gain Guard, +1 all sides.",         l4:"Adjacent Infantry gain Guard, +2 all sides. Deal 2 HQ damage." },
  { id:32, name:"Artillery Position",  type:"objective", category:"Damage",            l1:"Deal 1 HQ damage.",                                    l2:"Deal 1 hit to 1 enemy unit.",                      l3:"Deal 2 HQ damage.",                                   l4:"Deal 3 HQ damage. Deal 1 hit to 1 enemy unit." },
  { id:33, name:"Fortification",       type:"objective", category:"Defense",           l1:"Adjacent units gain Fortified this turn.",              l2:"Adjacent units gain Fortified until next turn.",   l3:"Adjacent units gain Fortified, +1 all sides.",        l4:"Adjacent units gain Fortified, +2 all sides. Deal 2 HQ damage." },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
```

- [ ] **Step 2: Open `digital/js/cards.js` in browser console to verify**

Open VS Code terminal, run:
```
node -e "import('./digital/js/cards.js').then(m => console.log(m.CARDS.length + ' cards loaded'))"
```
Expected: `83 cards loaded`

(If Node version doesn't support ES modules, open the file and count lines manually — the count should be 83 card entries. That's fine too.)

- [ ] **Step 3: Commit**
```bash
git add digital/js/cards.js
git commit -m "feat: add card data module (83 cards)"
```

---

### Task 2: Game State Model

**Files:**
- Create: `digital/js/state.js`

This file defines what the game state looks like and exports pure functions that produce new states from old ones + an action. No DOM, no Firebase.

- [ ] **Step 1: Create `digital/js/state.js`**

```js
// Game state shape:
// {
//   turn: number,                    — turn number, starts at 1
//   initiative: "p1" | "p2",        — whose turn it is
//   phase: "draw"|"play"|"end",     — current phase
//   p1: PlayerState,
//   p2: PlayerState,
//   board: { [tileKey]: BoardUnit | null },   — tileKey = "row,col" e.g. "0,0"
//   objectives: { [tileKey]: { cardId, level } },
//   log: string[],                   — last 10 action descriptions
// }
//
// PlayerState: {
//   hq: number,           — HQ HP, starts at 20
//   fuel: number,         — current fuel (max 6)
//   pendingFuelGain: number, — delayed gains (Industrial Surge etc.)
//   hand: number[],       — cardIds in hand
//   deck: number[],       — cardIds remaining in deck (top = index 0)
//   missions: ActiveMission[],
//   tempFuelDiscount: number,  — for Armored Spearhead etc.
// }
//
// ActiveMission: { cardId, turnsRemaining, progress }
//
// BoardUnit: {
//   cardId: number,
//   owner: "p1" | "p2",
//   state: "normal" | "suppressed" | "destroyed",
//   armorHits: number,          — hits absorbed by armor so far
//   tempKeywords: string[],     — keywords added this turn (Smoke Screen etc.)
//   tempSideBonus: number,      — temporary +N to all sides (Rally Cry etc.)
//   justPlaced: boolean,        — true only on the turn this unit was deployed
// }

import { CARD_BY_ID } from './cards.js';

export function createInitialState(p1Deck, p2Deck) {
  return {
    turn: 1,
    initiative: "p1",
    phase: "play",
    p1: createPlayerState(p1Deck),
    p2: createPlayerState(p2Deck),
    board: Object.fromEntries(
      Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 4 }, (_, c) => [`${r},${c}`, null])
      ).flat()
    ),
    objectives: {},
    log: [],
  };
}

function createPlayerState(deckCardIds) {
  const shuffled = [...deckCardIds].sort(() => Math.random() - 0.5);
  const hand = shuffled.slice(0, 5);
  const deck = shuffled.slice(5);
  return { hq: 20, fuel: 0, pendingFuelGain: 0, hand, deck, missions: [], tempFuelDiscount: 0 };
}

// Returns the side value of a unit facing a given direction, including temp bonuses.
export function getSideValue(boardUnit, direction) {
  const card = CARD_BY_ID[boardUnit.cardId];
  if (!card || card.type !== "unit") return 0;
  const base = card[direction]; // direction is "n", "e", "s", "w"
  return base + (boardUnit.tempSideBonus || 0);
}

// Returns the opposite direction (attacker's south faces defender's north, etc.)
export function oppositeDir(dir) {
  return { n: "s", s: "n", e: "w", w: "e" }[dir];
}

// Returns the active keywords for a board unit (card keyword + temp keywords).
export function getKeywords(boardUnit) {
  const card = CARD_BY_ID[boardUnit.cardId];
  const base = card?.keyword ? [card.keyword] : [];
  return [...base, ...(boardUnit.tempKeywords || [])];
}

// Max armor hits before damage starts (based on keyword).
export function maxArmorHits(boardUnit) {
  const kws = getKeywords(boardUnit);
  if (kws.includes("Heavy Armor")) return 2;
  if (kws.includes("Armor")) return 1;
  return 0;
}

// How many total hits to destroy a unit.
export function hitsToDestroy(boardUnit) {
  return maxArmorHits(boardUnit) + 2; // armor absorbs N hits, then Suppressed, then Destroyed
}

// Apply a hit to a unit. Returns { newUnit, hqDamage } where hqDamage is dealt to the owner's HQ.
export function applyHit(boardUnit) {
  const unit = { ...boardUnit };
  let hqDamage = 0;

  const armor = maxArmorHits(unit);

  if (unit.armorHits < armor) {
    // Armor absorbs — no state change, no HQ damage
    unit.armorHits += 1;
    return { newUnit: unit, hqDamage: 0 };
  }

  if (unit.state === "normal") {
    unit.state = "suppressed";
    hqDamage = 1; // Suppress = 1 HQ damage to the unit owner's opponent (attacker gains)
    return { newUnit: unit, hqDamage };
  }

  if (unit.state === "suppressed") {
    unit.state = "destroyed";
    hqDamage = 2; // Destroy = 2 HQ damage
    return { newUnit: unit, hqDamage };
  }

  // Already destroyed — shouldn't happen, but safe fallback
  return { newUnit: unit, hqDamage: 0 };
}

// Determine if attacker's side value beats defender's facing side.
// attDir: direction attacker is attacking FROM (e.g. attacker is N of defender → attDir = "s")
// Tie rule: attacker wins.
export function attackBeats(attacker, attDir, defender) {
  const kws = getKeywords(defender);
  if (kws.includes("Guard") && defender.state !== "suppressed") {
    // Guard: attack fails unless it's explicitly targeting the Guard unit (handled by UI)
    // This function just compares values; Guard targeting logic is handled in combat.js
  }
  const attValue = getSideValue(attacker, attDir);
  const defValue = getSideValue(defender, oppositeDir(attDir));
  return attValue >= defValue; // tie goes to attacker
}

// Drain fuel for the active player. Returns new fuel value (min 0).
export function spendFuel(playerState, amount) {
  return { ...playerState, fuel: Math.max(0, playerState.fuel - amount) };
}

// Gain fuel for the active player. Returns new fuel (max 6).
export function gainFuel(playerState, amount) {
  return { ...playerState, fuel: Math.min(6, playerState.fuel + amount) };
}

// Draw N cards from deck into hand. Stops if deck is empty.
export function drawCards(playerState, n) {
  const ps = { ...playerState };
  const drawn = ps.deck.slice(0, n);
  ps.hand = [...ps.hand, ...drawn];
  ps.deck = ps.deck.slice(n);
  return ps;
}

// Start-of-turn setup: gain 3 fuel, apply pending gains, decrement mission timers.
export function startOfTurn(state) {
  const activePlayer = state.initiative;
  let ps = { ...state[activePlayer] };
  ps = gainFuel(ps, 3 + ps.pendingFuelGain);
  ps.pendingFuelGain = 0;
  ps.missions = ps.missions
    .map(m => ({ ...m, turnsRemaining: m.turnsRemaining - 1 }))
    .filter(m => m.turnsRemaining > 0);
  return { ...state, [activePlayer]: ps };
}

// End current turn: swap initiative, advance turn counter, clear justPlaced flags.
export function endTurn(state) {
  const newBoard = Object.fromEntries(
    Object.entries(state.board).map(([k, v]) => [k, v ? { ...v, justPlaced: false, tempKeywords: [], tempSideBonus: 0 } : null])
  );
  return {
    ...state,
    board: newBoard,
    initiative: state.initiative === "p1" ? "p2" : "p1",
    turn: state.turn + 1,
  };
}

// Objective level based on turn number. L1: turns 2-3, L2: turns 4-5, L3: turns 6-7, L4: turn 8+.
// Turn 1 has no objective bonus.
export function objectiveLevel(turn) {
  if (turn < 2) return 0;
  if (turn <= 3) return 1;
  if (turn <= 5) return 2;
  if (turn <= 7) return 3;
  return 4;
}
```

- [ ] **Step 2: Manually verify `createInitialState` in browser console**

Open `digital/js/state.js` in a simple test page, or run via node:
```
node --input-type=module << 'EOF'
import { createInitialState, objectiveLevel } from './digital/js/state.js';
const s = createInitialState([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25], [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]);
console.log("P1 hand size:", s.p1.hand.length);      // Expected: 5
console.log("P1 deck size:", s.p1.deck.length);      // Expected: 20
console.log("P1 HQ:", s.p1.hq);                       // Expected: 20
console.log("Board tiles:", Object.keys(s.board).length); // Expected: 16
console.log("L at turn 4:", objectiveLevel(4));       // Expected: 2
console.log("L at turn 8:", objectiveLevel(8));       // Expected: 4
EOF
```

- [ ] **Step 3: Commit**
```bash
git add digital/js/state.js
git commit -m "feat: game state model + pure transition functions"
```

---

### Task 3: Combat Engine

**Files:**
- Create: `digital/js/combat.js`

All combat resolution lives here. A "resolve combat" call takes the current board state and a placement event, and returns a list of state mutations.

- [ ] **Step 1: Create `digital/js/combat.js`**

```js
import { CARD_BY_ID } from './cards.js';
import { getSideValue, getKeywords, attackBeats, applyHit, maxArmorHits } from './state.js';

// Directions a unit attacks when placed: attacks all 4 adjacent cells.
const DIRS = ["n", "e", "s", "w"];
const DIR_OFFSET = { n: [-1, 0], e: [0, 1], s: [1, 0], w: [0, -1] };

export function tileKey(row, col) { return `${row},${col}`; }
export function tileCoords(key) { return key.split(",").map(Number); }

// Returns adjacent tile keys that are on the board.
export function adjacentTiles(row, col) {
  return DIRS.flatMap(dir => {
    const [dr, dc] = DIR_OFFSET[dir];
    const r = row + dr, c = col + dc;
    return r >= 0 && r < 4 && c >= 0 && c < 4 ? [{ key: tileKey(r, c), dir }] : [];
  });
}

// Main function: resolve all attacks when a unit is placed at (row, col).
// Returns { boardMutations, hqDamageToP1, hqDamageToP2, logEntries }
// boardMutations: array of { key, newUnit } to apply to state.board
export function resolveDeployment(state, row, col) {
  const key = tileKey(row, col);
  const attacker = state.board[key];
  if (!attacker || !attacker.justPlaced) return { boardMutations: [], hqDamageToP1: 0, hqDamageToP2: 0, logEntries: [] };

  const card = CARD_BY_ID[attacker.cardId];
  const kws = getKeywords(attacker);
  const owner = attacker.owner;
  const enemy = owner === "p1" ? "p2" : "p1";

  const boardMutations = [];
  let hqDamageToP1 = 0;
  let hqDamageToP2 = 0;
  const logEntries = [];

  const attacks = buildAttackList(attacker, row, col, kws, card, state);

  for (const { targetKey, dir } of attacks) {
    const defender = state.board[targetKey];
    if (!defender || defender.owner === owner) continue;

    // Guard: if there's a Guard unit, you must target it first.
    // (In this prototype, Guard enforcement is handled by UI — the player must choose the Guard unit.
    //  resolveDeployment trusts that the targetKey is legal.)

    if (!attackBeats(attacker, dir, defender)) {
      logEntries.push(`${card.name} attacked ${CARD_BY_ID[defender.cardId].name} — failed (${getSideValue(attacker, dir)} vs ${getSideValue(defender, { n:"s", s:"n", e:"w", w:"e" }[dir])})`);
      continue;
    }

    const { newUnit, hqDamage } = applyHit(defender);
    boardMutations.push({ key: targetKey, newUnit });

    // HQ damage goes to the unit owner's HQ (the one being attacked)
    if (defender.owner === "p1") hqDamageToP1 += hqDamage;
    else hqDamageToP2 += hqDamage;

    const stateStr = newUnit.state === "destroyed" ? "Destroyed" : newUnit.state === "suppressed" ? "Suppressed" : "(armor absorbed)";
    logEntries.push(`${card.name} → ${CARD_BY_ID[defender.cardId].name}: ${stateStr} (${getSideValue(attacker, dir)} vs ${getSideValue(defender, { n:"s", s:"n", e:"w", w:"e" }[dir])})`);

    // Breakthrough: if Destroy, unit continues — handled by the caller checking all mutations
    // and re-calling with Breakthrough move. Simplified for v1: Breakthrough just means the attack resolves.
  }

  return { boardMutations, hqDamageToP1, hqDamageToP2, logEntries };
}

// Bombard: attacks the tile 2 steps in the unit's strongest direction.
function getBombardTarget(card, row, col) {
  const dirs = DIRS.map(d => ({ d, val: card[d] })).sort((a, b) => b.val - a.val);
  const strongest = dirs[0].d;
  const [dr, dc] = DIR_OFFSET[strongest];
  const r = row + dr * 2, c = col + dc * 2;
  if (r >= 0 && r < 4 && c >= 0 && c < 4) return [{ key: tileKey(r, c), dir: strongest }];
  return [];
}

// Build the full list of attack targets for this unit given its keywords.
function buildAttackList(attacker, row, col, kws, card, state) {
  if (kws.includes("Bombard")) {
    // Bombard: attacks one tile 2 steps ahead (in strongest direction), not adjacent.
    return getBombardTarget(card, row, col);
  }

  const adjacent = adjacentTiles(row, col)
    .filter(({ key }) => {
      const t = state.board[key];
      return t && t.owner !== attacker.owner;
    });

  if (kws.includes("Double Attack")) {
    // Double Attack: attacks up to 2 adjacent enemies. In this prototype, all adjacent enemies.
    return adjacent;
  }

  // Default: attack all adjacent enemies (Triple Triad style — simultaneous on placement)
  return adjacent;
}
```

- [ ] **Step 2: Manually test combat logic**

Run in node:
```
node --input-type=module << 'EOF'
import { resolveDeployment, tileKey } from './digital/js/combat.js';
import { createInitialState, applyHit } from './digital/js/state.js';

// Test applyHit sequence on a vanilla unit
const unit = { cardId: 1, owner: "p2", state: "normal", armorHits: 0, tempKeywords: [], tempSideBonus: 0, justPlaced: false };
const h1 = applyHit(unit);
console.log("After hit 1:", h1.newUnit.state, "HQ dmg:", h1.hqDamage); // suppressed, 1
const h2 = applyHit(h1.newUnit);
console.log("After hit 2:", h2.newUnit.state, "HQ dmg:", h2.hqDamage); // destroyed, 2

// Test Armor unit (Halftrack, id:6)
const armor = { cardId: 6, owner: "p2", state: "normal", armorHits: 0, tempKeywords: [], tempSideBonus: 0, justPlaced: false };
const a1 = applyHit(armor);
console.log("Armor hit 1:", a1.newUnit.state, "HQ dmg:", a1.hqDamage); // normal, 0 (absorbed)
const a2 = applyHit(a1.newUnit);
console.log("Armor hit 2:", a2.newUnit.state, "HQ dmg:", a2.hqDamage); // suppressed, 1
EOF
```
Expected output:
```
After hit 1: suppressed HQ dmg: 1
After hit 2: destroyed HQ dmg: 2
Armor hit 1: normal HQ dmg: 0
Armor hit 2: suppressed HQ dmg: 1
```

- [ ] **Step 3: Commit**
```bash
git add digital/js/combat.js
git commit -m "feat: combat engine — hit resolution, armor, bombard"
```

---

### Task 4: Game Board UI

**Files:**
- Create: `digital/game.html`
- Create: `digital/css/game.css`
- Create: `digital/js/ui.js`

This is where you can first *see* the game. No Firebase yet — uses a hardcoded local state.

- [ ] **Step 1: Create `digital/css/game.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: Arial, sans-serif;
  background: #1a1a2e;
  color: #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  gap: 12px;
  min-height: 100vh;
}

/* ── HQ bars ── */
.hq-bar {
  width: 100%;
  max-width: 700px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #16213e;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
}
.hq-label { font-weight: bold; letter-spacing: 1px; }
.hq-hp { font-size: 22px; font-weight: bold; color: #e94560; }
.fuel-display { font-size: 14px; color: #f5a623; }

/* ── Board ── */
.board-area { position: relative; }
.board {
  display: grid;
  grid-template-columns: repeat(4, 120px);
  grid-template-rows: repeat(4, 120px);
  gap: 4px;
  background: #0f3460;
  padding: 8px;
  border-radius: 8px;
}

.tile {
  width: 120px;
  height: 120px;
  background: #16213e;
  border: 2px solid #0f3460;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s;
}
.tile.highlight { border-color: #f5a623; }
.tile.valid-drop { border-color: #4caf50; background: #1a3a1a; }
.tile.has-unit { cursor: default; }

/* Objective tile marker */
.tile.objective-tile { background: #2a2a1a; }
.objective-label {
  position: absolute;
  top: 2px; left: 2px;
  font-size: 8px;
  color: #f5a623;
  background: rgba(0,0,0,0.6);
  padding: 1px 3px;
  border-radius: 2px;
}

/* ── Mini card on board ── */
.board-card {
  width: 110px;
  height: 110px;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 9px;
  position: relative;
  border: 2px solid transparent;
}
.board-card.p1 { border-color: #4caf50; background: #0d2010; }
.board-card.p2 { border-color: #e94560; background: #200d10; }
.board-card.suppressed { opacity: 0.6; border-style: dashed; }
.board-card.destroyed { opacity: 0.3; filter: grayscale(1); }

.bc-name { padding: 2px 3px; font-weight: bold; font-size: 8px; white-space: nowrap; overflow: hidden; }
.bc-dirs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  flex: 1;
  font-size: 11px;
  font-weight: bold;
  text-align: center;
}
.bc-dirs > div { display: flex; align-items: center; justify-content: center; }
.bc-keyword { padding: 0 3px; font-size: 7px; color: #aaa; background: rgba(0,0,0,0.3); }
.bc-state { position: absolute; bottom: 1px; right: 2px; font-size: 7px; color: #f5a623; font-weight: bold; }

/* ── Hand ── */
.hand-area {
  width: 100%;
  max-width: 700px;
}
.hand-label { font-size: 11px; color: #888; margin-bottom: 4px; }
.hand {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hand-card {
  width: 80px;
  height: 110px;
  border: 2px solid #333;
  border-radius: 4px;
  background: #16213e;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 8px;
  transition: border-color 0.15s, transform 0.1s;
}
.hand-card:hover { border-color: #f5a623; transform: translateY(-4px); }
.hand-card.selected { border-color: #4caf50; transform: translateY(-8px); }

.hc-header { padding: 2px 3px; background: #0f3460; font-weight: bold; font-size: 7.5px; }
.hc-cost { font-size: 11px; font-weight: bold; color: #f5a623; padding: 2px 3px; }
.hc-type { font-size: 6.5px; color: #888; padding: 0 3px; }
.hc-dirs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  flex: 1;
  font-size: 10px;
  font-weight: bold;
  text-align: center;
}
.hc-dirs > div { display: flex; align-items: center; justify-content: center; }
.hc-keyword { font-size: 6px; color: #aaa; padding: 0 3px; }
.hc-effect { padding: 2px 3px; font-size: 6px; color: #ccc; line-height: 1.3; flex: 1; overflow: hidden; }

/* ── Controls ── */
.controls { display: flex; gap: 12px; }
.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
}
.btn-primary { background: #e94560; color: #fff; }
.btn-secondary { background: #0f3460; color: #eee; }

/* ── Log ── */
.log {
  width: 100%;
  max-width: 700px;
  background: #0d0d1a;
  border-radius: 4px;
  padding: 8px;
  font-size: 11px;
  color: #888;
  max-height: 80px;
  overflow-y: auto;
}
.log-entry { margin-bottom: 2px; }
```

- [ ] **Step 2: Create `digital/js/ui.js`**

```js
import { CARD_BY_ID } from './cards.js';
import { getKeywords } from './state.js';

// Render the 4x4 board from state into the #board element.
// selectedTileKey: tile currently selected/highlighted (string or null)
// validDropKeys: set of tile keys where selected hand card can be placed
export function renderBoard(state, selectedTileKey, validDropKeys) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const key = `${r},${c}`;
      const unit = state.board[key];
      const obj = state.objectives[key];

      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.key = key;

      if (obj) {
        tile.classList.add('objective-tile');
        const objCard = CARD_BY_ID[obj.cardId];
        const lbl = document.createElement('div');
        lbl.className = 'objective-label';
        lbl.textContent = `${objCard?.name ?? '?'} L${obj.level}`;
        tile.appendChild(lbl);
      }

      if (unit && unit.state !== 'destroyed') {
        tile.classList.add('has-unit');
        tile.appendChild(renderBoardCard(unit));
      } else if (validDropKeys?.has(key)) {
        tile.classList.add('valid-drop');
      }

      if (key === selectedTileKey) tile.classList.add('highlight');

      board.appendChild(tile);
    }
  }
}

function renderBoardCard(unit) {
  const card = CARD_BY_ID[unit.cardId];
  const el = document.createElement('div');
  el.className = `board-card ${unit.owner} ${unit.state}`;

  const kws = getKeywords(unit).join(', ') || '';
  const stateLabel = unit.state === 'suppressed' ? 'SUP' : '';

  if (card.type === 'unit') {
    el.innerHTML = `
      <div class="bc-name">${card.name}</div>
      <div class="bc-dirs">
        <div></div><div>${card.n + (unit.tempSideBonus||0)}</div><div></div>
        <div>${card.w + (unit.tempSideBonus||0)}</div><div style="font-size:7px;color:#aaa">${card.cls[0]}</div><div>${card.e + (unit.tempSideBonus||0)}</div>
        <div></div><div>${card.s + (unit.tempSideBonus||0)}</div><div></div>
      </div>
      <div class="bc-keyword">${kws}</div>
      ${stateLabel ? `<div class="bc-state">${stateLabel}</div>` : ''}
    `;
  } else {
    el.innerHTML = `<div class="bc-name">${card.name}</div>`;
  }

  return el;
}

// Render a player's hand into the given element id.
// selectedCardId: card currently selected in hand (or null)
export function renderHand(handCardIds, containerId, selectedCardId) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';

  handCardIds.forEach(cardId => {
    const card = CARD_BY_ID[cardId];
    if (!card) return;

    const div = document.createElement('div');
    div.className = `hand-card${cardId === selectedCardId ? ' selected' : ''}`;
    div.dataset.cardId = cardId;

    if (card.type === 'unit') {
      div.innerHTML = `
        <div class="hc-header">${card.name}</div>
        <div class="hc-cost">${card.cost} ⛽ <span style="font-size:9px;color:#aaa">AP${card.ap}</span></div>
        <div class="hc-type">${card.cls}</div>
        <div class="hc-dirs">
          <div></div><div>${card.n}</div><div></div>
          <div>${card.w}</div><div style="color:#555">·</div><div>${card.e}</div>
          <div></div><div>${card.s}</div><div></div>
        </div>
        <div class="hc-keyword">${card.keyword || ''}</div>
      `;
    } else if (card.type === 'command' || card.type === 'mission') {
      div.innerHTML = `
        <div class="hc-header">${card.name}</div>
        <div class="hc-cost">${card.cost} ⛽</div>
        <div class="hc-type">${card.type}</div>
        <div class="hc-effect">${card.effect || card.req || ''}</div>
      `;
    } else {
      div.innerHTML = `<div class="hc-header">${card.name}</div><div class="hc-type">Objective</div>`;
    }

    el.appendChild(div);
  });
}

// Update HQ and fuel displays.
export function renderHQ(state) {
  document.getElementById('p1-hq').textContent = state.p1.hq;
  document.getElementById('p2-hq').textContent = state.p2.hq;
  document.getElementById('p1-fuel').textContent = '⛽'.repeat(state.p1.fuel) + `  (${state.p1.fuel}/6)`;
  document.getElementById('p2-fuel').textContent = '⛽'.repeat(state.p2.fuel) + `  (${state.p2.fuel}/6)`;
  document.getElementById('turn-display').textContent = `Turn ${state.turn} — ${state.initiative.toUpperCase()} to play`;
}

// Append to the game log.
export function appendLog(entries) {
  const log = document.getElementById('game-log');
  entries.forEach(e => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = e;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}
```

- [ ] **Step 3: Create `digital/game.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SIGNAL — Digital Prototype</title>
  <link rel="stylesheet" href="css/game.css">
</head>
<body>

  <!-- P2 HQ (top) -->
  <div class="hq-bar">
    <span class="hq-label">P2 HQ</span>
    <span class="hq-hp" id="p2-hq">20</span>
    <span class="fuel-display" id="p2-fuel">⛽ 0/6</span>
  </div>

  <!-- Board -->
  <div class="board-area">
    <div class="board" id="board"></div>
  </div>

  <!-- P1 HQ (bottom) -->
  <div class="hq-bar">
    <span class="hq-label">P1 HQ</span>
    <span class="hq-hp" id="p1-hq">20</span>
    <span class="fuel-display" id="p1-fuel">⛽ 0/6</span>
  </div>

  <!-- Turn indicator -->
  <div id="turn-display" style="font-size:13px;color:#aaa;"></div>

  <!-- Controls -->
  <div class="controls">
    <button class="btn btn-primary" id="btn-end-turn">End Turn</button>
    <button class="btn btn-secondary" id="btn-cancel">Cancel</button>
  </div>

  <!-- P1 Hand -->
  <div class="hand-area">
    <div class="hand-label">YOUR HAND (P1)</div>
    <div class="hand" id="p1-hand"></div>
  </div>

  <!-- Log -->
  <div class="log" id="game-log"></div>

<script type="module">
import { CARD_BY_ID } from './js/cards.js';
import { createInitialState, startOfTurn, endTurn, spendFuel, drawCards } from './js/state.js';
import { resolveDeployment, tileKey, adjacentTiles } from './js/combat.js';
import { renderBoard, renderHand, renderHQ, appendLog } from './js/ui.js';

// Sample 10-card test deck for each player (IDs from cards.js)
const testDeck = [1, 2, 3, 6, 7, 8, 9, 10, 12, 13, 18, 19, 22, 24, 25, 34, 38, 39, 16, 17, 18, 19, 1, 2, 3];

let state = createInitialState(testDeck, [...testDeck].reverse());
state = startOfTurn(state); // give P1 initial fuel

// Place 2 objectives for testing
state.objectives["1,1"] = { cardId: 27, level: 1 }; // Airfield
state.objectives["2,2"] = { cardId: 32, level: 1 }; // Artillery Position

let selectedCardId = null; // card selected from hand
let pendingPlaceCardId = null; // card waiting to be placed on board

function redraw() {
  const activePlayer = state.initiative;
  const handIds = state[activePlayer].hand;
  renderBoard(state, null, pendingPlaceCardId ? getValidTiles() : null);
  renderHand(handIds, 'p1-hand', selectedCardId);
  renderHQ(state);
}

function getValidTiles() {
  // Any empty tile is a valid placement target for now.
  // (Naval restriction — water tiles — deferred to Phase 3.)
  const valid = new Set();
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (!state.board[tileKey(r, c)]) valid.add(tileKey(r, c));
  return valid;
}

// Hand card click
document.getElementById('p1-hand').addEventListener('click', e => {
  const cardEl = e.target.closest('.hand-card');
  if (!cardEl) return;
  const cardId = Number(cardEl.dataset.cardId);
  const card = CARD_BY_ID[cardId];

  if (selectedCardId === cardId) {
    selectedCardId = null;
    pendingPlaceCardId = null;
  } else {
    selectedCardId = cardId;
    if (card.type === 'unit') pendingPlaceCardId = cardId;
    else pendingPlaceCardId = null;
  }
  redraw();
});

// Board tile click — place selected unit
document.getElementById('board').addEventListener('click', e => {
  const tile = e.target.closest('.tile');
  if (!tile || !pendingPlaceCardId) return;
  const key = tile.dataset.key;
  if (state.board[key]) return; // occupied

  const [row, col] = key.split(',').map(Number);
  const activePlayer = state.initiative;
  const card = CARD_BY_ID[pendingPlaceCardId];

  if (state[activePlayer].fuel < card.cost) {
    appendLog([`Not enough Fuel to play ${card.name} (need ${card.cost}, have ${state[activePlayer].fuel})`]);
    return;
  }

  // Place unit on board
  state = {
    ...state,
    board: {
      ...state.board,
      [key]: {
        cardId: pendingPlaceCardId,
        owner: activePlayer,
        state: 'normal',
        armorHits: 0,
        tempKeywords: [],
        tempSideBonus: 0,
        justPlaced: true,
      }
    },
    [activePlayer]: {
      ...state[activePlayer],
      fuel: state[activePlayer].fuel - card.cost,
      hand: state[activePlayer].hand.filter(id => id !== pendingPlaceCardId),
    }
  };

  // Resolve combat
  const result = resolveDeployment(state, row, col);

  // Apply board mutations
  let newBoard = { ...state.board };
  for (const { key: k, newUnit } of result.boardMutations) {
    newBoard[k] = newUnit;
  }

  // Apply HQ damage
  state = {
    ...state,
    board: newBoard,
    p1: { ...state.p1, hq: state.p1.hq - result.hqDamageToP1 },
    p2: { ...state.p2, hq: state.p2.hq - result.hqDamageToP2 },
  };

  appendLog([`Placed ${card.name} at ${key}`, ...result.logEntries]);

  selectedCardId = null;
  pendingPlaceCardId = null;

  // Check win condition
  if (state.p1.hq <= 0) { appendLog(["P2 wins! P1 HQ destroyed."]); }
  if (state.p2.hq <= 0) { appendLog(["P1 wins! P2 HQ destroyed."]); }

  redraw();
});

// End turn
document.getElementById('btn-end-turn').addEventListener('click', () => {
  state = endTurn(state);
  // Draw 1 card for the new active player
  state = { ...state, [state.initiative]: drawCards(state[state.initiative], 1) };
  state = startOfTurn(state);
  appendLog([`--- Turn ${state.turn} — ${state.initiative.toUpperCase()} ---`]);
  selectedCardId = null;
  pendingPlaceCardId = null;
  redraw();
});

document.getElementById('btn-cancel').addEventListener('click', () => {
  selectedCardId = null;
  pendingPlaceCardId = null;
  redraw();
});

redraw();
</script>
</body>
</html>
```

- [ ] **Step 4: Open in browser and play-test**

Open `digital/game.html` in Chrome/Edge directly (double-click the file, or use VS Code Live Server extension).

Check:
- [ ] Board renders 4×4 grid with objective labels visible
- [ ] Hand shows cards with N/E/S/W values
- [ ] Clicking a unit card highlights it and shows valid tiles in green
- [ ] Clicking a tile places the card, deducts Fuel
- [ ] Combat log shows attack results
- [ ] HQ values decrease when units get Suppressed/Destroyed
- [ ] End Turn swaps initiative label

- [ ] **Step 5: Commit**
```bash
git add digital/game.html digital/css/game.css digital/js/ui.js
git commit -m "feat: game board UI — board, hand, HQ display, basic placement and combat"
```

**Phase 1 complete.** You now have a local solo sandbox where you can place cards, see combat resolve, and watch HQ values drop.

---

## Phase 2: Online Multiplayer (Session 4)

Goal: two different browsers (or two tabs) see the same game state in real time. One player creates a game, the other joins by code.

**Before starting Phase 2:** Complete the Firebase setup steps in `digital/FIREBASE_SETUP.md` (created below in Task 5).

---

### Task 5: Firebase Setup Instructions

**Files:**
- Create: `digital/FIREBASE_SETUP.md`

- [ ] **Step 1: Create `digital/FIREBASE_SETUP.md`**

```markdown
# Firebase Setup

## 1. Create a Firebase project
1. Go to https://console.firebase.google.com
2. Click "Add project", name it "signal-card-game", skip Google Analytics
3. Once created, click "Build" → "Realtime Database" in the sidebar
4. Click "Create Database", choose any region, start in **Test mode** (allows all reads/writes — fine for prototype)

## 2. Get your config keys
1. Click the gear icon (Project Settings) → "Your apps"
2. Click the `</>` Web icon to register a web app
3. Name it "signal-prototype", skip Firebase Hosting
4. Copy the firebaseConfig object that appears — it looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "signal-card-game.firebaseapp.com",
     databaseURL: "https://signal-card-game-default-rtdb.firebaseio.com",
     projectId: "signal-card-game",
     storageBucket: "signal-card-game.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123:web:abc"
   };
   ```

## 3. Paste config into firebase.js
Open `digital/js/firebase.js` and replace the placeholder config object with yours.

## 4. Security rules (test mode is fine for now)
Test mode rules allow all reads/writes for 30 days. For production you'd add authentication, but for a prototype this is fine.
```

- [ ] **Step 2: Commit**
```bash
git add digital/FIREBASE_SETUP.md
git commit -m "docs: Firebase setup instructions"
```

---

### Task 6: Firebase Sync Layer

**Files:**
- Create: `digital/js/firebase.js`

- [ ] **Step 1: Create `digital/js/firebase.js`** (paste your real firebaseConfig in the marked spot)

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── PASTE YOUR FIREBASE CONFIG HERE ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  databaseURL: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};
// ─────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Write the full game state to Firebase.
export function pushState(gameId, state) {
  return set(ref(db, `games/${gameId}`), state);
}

// Read the current state once.
export async function fetchState(gameId) {
  const snap = await get(ref(db, `games/${gameId}`));
  return snap.exists() ? snap.val() : null;
}

// Subscribe to real-time updates. Calls callback(state) whenever state changes.
// Returns an unsubscribe function.
export function subscribeState(gameId, callback) {
  const r = ref(db, `games/${gameId}`);
  const unsub = onValue(r, snap => {
    if (snap.exists()) callback(snap.val());
  });
  return unsub;
}

// Generate a 6-character uppercase game code.
export function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
```

- [ ] **Step 2: Commit**
```bash
git add digital/js/firebase.js
git commit -m "feat: Firebase sync layer"
```

---

### Task 7: Lobby Page

**Files:**
- Create: `digital/index.html`
- Create: `digital/css/lobby.css`
- Create: `digital/js/lobby.js`

- [ ] **Step 1: Create `digital/css/lobby.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, sans-serif;
  background: #1a1a2e;
  color: #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 20px;
}
h1 { font-size: 32px; letter-spacing: 2px; color: #e94560; }
.subtitle { font-size: 14px; color: #888; }
.card-lobby {
  background: #16213e;
  border-radius: 8px;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 320px;
}
.input {
  padding: 10px 12px;
  border-radius: 4px;
  border: 2px solid #0f3460;
  background: #0d0d1a;
  color: #eee;
  font-size: 16px;
  text-align: center;
  letter-spacing: 3px;
  text-transform: uppercase;
}
.input:focus { outline: none; border-color: #e94560; }
.btn {
  padding: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 15px;
  font-weight: bold;
}
.btn-create { background: #e94560; color: #fff; }
.btn-join { background: #0f3460; color: #eee; }
.divider { text-align: center; color: #444; font-size: 12px; }
.status { font-size: 13px; color: #f5a623; text-align: center; min-height: 20px; }
.game-code-display { font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #4caf50; text-align: center; }
```

- [ ] **Step 2: Create `digital/js/lobby.js`**

```js
import { pushState, fetchState, subscribeState, generateGameCode } from './firebase.js';
import { createInitialState, startOfTurn } from './state.js';

const testDeck = [1,2,3,6,7,8,9,10,12,13,18,19,22,24,25,34,38,39,16,17,1,2,3,6,7];

const statusEl = document.getElementById('status');
const codeDisplay = document.getElementById('game-code-display');

document.getElementById('btn-create').addEventListener('click', async () => {
  const code = generateGameCode();
  statusEl.textContent = 'Creating game…';

  let state = createInitialState(testDeck, [...testDeck].reverse());
  state = startOfTurn(state);
  state.objectives = {
    "1,1": { cardId: 27, level: 1 },
    "2,2": { cardId: 32, level: 1 },
    "0,3": { cardId: 28, level: 1 },
  };

  await pushState(code, state);

  codeDisplay.textContent = code;
  statusEl.textContent = 'Share this code with your opponent. Waiting for them to join…';

  // Wait for opponent to join (they'll set state.p2Joined = true)
  const unsub = subscribeState(code, s => {
    if (s.p2Joined) {
      unsub();
      window.location.href = `game.html?game=${code}&player=p1`;
    }
  });
});

document.getElementById('btn-join').addEventListener('click', async () => {
  const code = document.getElementById('join-code').value.toUpperCase().trim();
  if (code.length !== 6) { statusEl.textContent = 'Enter a 6-character code.'; return; }

  statusEl.textContent = 'Joining…';
  const state = await fetchState(code);
  if (!state) { statusEl.textContent = 'Game not found. Check the code.'; return; }

  await pushState(code, { ...state, p2Joined: true });
  window.location.href = `game.html?game=${code}&player=p2`;
});
```

- [ ] **Step 3: Create `digital/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SIGNAL — Lobby</title>
  <link rel="stylesheet" href="css/lobby.css">
</head>
<body>
  <h1>SIGNAL</h1>
  <div class="subtitle">WWII Tactical Card Game — Digital Prototype</div>

  <div class="card-lobby">
    <button class="btn btn-create" id="btn-create">Create New Game</button>
    <div class="game-code-display" id="game-code-display"></div>
    <div class="divider">── or join ──</div>
    <input class="input" id="join-code" placeholder="ENTER CODE" maxlength="6">
    <button class="btn btn-join" id="btn-join">Join Game</button>
    <div class="status" id="status"></div>
  </div>

  <script type="module" src="js/lobby.js"></script>
</body>
</html>
```

- [ ] **Step 4: Wire multiplayer into `game.html`**

At the top of the `<script type="module">` block in `game.html`, add Firebase sync. The game reads the URL params `?game=CODE&player=p1` to know which game to connect to and which side you're playing.

Replace the opening of the script block in `game.html` with:

```js
import { CARD_BY_ID } from './js/cards.js';
import { createInitialState, startOfTurn, endTurn, spendFuel, drawCards } from './js/state.js';
import { resolveDeployment, tileKey } from './js/combat.js';
import { renderBoard, renderHand, renderHQ, appendLog } from './js/ui.js';
import { pushState, subscribeState } from './js/firebase.js';

const params = new URLSearchParams(window.location.search);
const gameId = params.get('game');
const myPlayer = params.get('player') || 'p1'; // 'p1' or 'p2'
const isOnline = !!gameId;

const testDeck = [1,2,3,6,7,8,9,10,12,13,18,19,22,24,25,34,38,39,16,17,1,2,3,6,7];

let state;
let unsubscribe;

if (isOnline) {
  // Online mode: subscribe to Firebase, render on every remote update
  unsubscribe = subscribeState(gameId, remoteState => {
    state = remoteState;
    redraw();
  });
} else {
  // Offline solo mode (for local testing — open file directly without ?game=)
  state = createInitialState(testDeck, [...testDeck].reverse());
  state = startOfTurn(state);
  state.objectives = { "1,1": { cardId: 27, level: 1 }, "2,2": { cardId: 32, level: 1 } };
}

// After any local action, push state to Firebase if online.
async function commitState(newState, logLines) {
  state = newState;
  appendLog(logLines || []);
  redraw();
  if (isOnline) await pushState(gameId, state);
}

// Only allow interaction on your turn.
function isMyTurn() { return state.initiative === myPlayer; }
```

Then, inside the hand click handler and end-turn handler, replace direct `state = ...` assignments with `await commitState(newState, logLines)`.

- [ ] **Step 5: Test multiplayer locally**

1. Open `index.html` in Chrome, click "Create New Game", copy the 6-digit code.
2. Open a second Chrome tab, go to `index.html`, paste the code, click "Join".
3. Both tabs should redirect to `game.html`. In one tab place a card — the other tab should update within ~1 second.

- [ ] **Step 6: Commit**
```bash
git add digital/index.html digital/css/lobby.css digital/js/lobby.js
git commit -m "feat: lobby — create/join game by code, Firebase multiplayer wired into game.html"
```

**Phase 2 complete.** Two browsers can now play against each other in real time.

---

## Phase 3: Full Rules + Deploy (Sessions 5–6)

Goal: objectives escalate, missions trigger, deploy to GitHub Pages at a stable URL.

---

### Task 8: Objective Escalation

**Files:**
- Modify: `digital/game.html` (script block — startOfTurn handler)
- Modify: `digital/js/state.js` (already has `objectiveLevel`)

Objectives escalate every 2 turns. At the start of each turn, update all objective levels in `state.objectives`.

- [ ] **Step 1: Add `updateObjectiveLevels` to `digital/js/state.js`**

```js
export function updateObjectiveLevels(state) {
  const level = objectiveLevel(state.turn);
  if (level === 0) return state;
  const objectives = Object.fromEntries(
    Object.entries(state.objectives).map(([k, obj]) => [k, { ...obj, level }])
  );
  return { ...state, objectives };
}
```

- [ ] **Step 2: Call it in the end-turn flow in `game.html`**

In the `btn-end-turn` click handler, add after `state = startOfTurn(state)`:
```js
import { updateObjectiveLevels } from './js/state.js';
// ...
state = updateObjectiveLevels(state);
```

- [ ] **Step 3: Test**

Start a game, play to Turn 4. Objective labels in the top-left corner of objective tiles should read "L2". At Turn 6 they should read "L3".

- [ ] **Step 4: Commit**
```bash
git add digital/js/state.js digital/game.html
git commit -m "feat: objective escalation — levels update every 2 turns"
```

---

### Task 9: GitHub Pages Deploy

**Files:** none new — just git and GitHub settings

- [ ] **Step 1: Create a GitHub repository**

Go to github.com → New repository → name it `signal-prototype` → Public → Create.

- [ ] **Step 2: Push the project**

In VS Code terminal, from `c:\Users\Administrator\FilipWork\clients\wwii-card-game\digital\`:
```bash
git init
git add .
git commit -m "initial: SIGNAL digital prototype"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/signal-prototype.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Enable GitHub Pages**

On github.com, go to your repo → Settings → Pages → Source: "Deploy from a branch" → Branch: main, folder: / (root) → Save.

Wait ~60 seconds. Your game is now live at:
`https://YOUR_GITHUB_USERNAME.github.io/signal-prototype/`

Share `index.html` URL with opponent. Done.

- [ ] **Step 4: Test the live URL**

Open the live URL in two different browsers/devices. Create a game, join it, place cards. Verify multiplayer works over the real internet (not just localhost).

- [ ] **Step 5: Commit any fixes**
```bash
git add -A
git commit -m "fix: production URL adjustments"
git push
```

---

## What's NOT in this plan (deferred for later sessions)

- **Deck builder UI** — players pick 25 cards within 50 AP budget. Session 7+.
- **Command/Mission card interactive effects** — Field Medic, Tactical Withdrawal etc. require choosing a target. Needs a "targeting mode" UI state. Session 7+.
- **Guard enforcement in UI** — currently the player self-enforces Guard by choosing the right target. Needs explicit validation. Session 7+.
- **Map terrain tiles** — Normandy, Stalingrad etc. with visual terrain. Session 8+.
- **Naval restriction** — water-only tiles for Naval units. Tied to map tiles. Session 8+.
- **Inspire keyword effect** — requires tracking adjacent friendly units and applying +1 buff. Session 7+.
- **Breakthrough chaining** — after Destroy, unit slides into the destroyed tile and may attack again. Session 7+.
- **Win condition popup** — currently just a log message. Session 7+.
