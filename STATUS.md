# SIGNAL Prototype — Implementation Status

Legend: ✅ done | ⚠️ partial | ❌ missing

---

## Core Systems

| Feature | Status | Notes |
|---|---|---|
| Board rendering (4x4 grid) | ✅ | Terrain, objectives, unit cards all render |
| Hand rendering | ✅ | Shows your hand only; card stats + cost |
| Fuel system | ✅ | Gain 3/turn, cap 6, spent on play |
| HQ damage + win condition | ✅ | Suppress = 1, Destroy = 2; first to 0 loses |
| Initiative swap | ✅ | Alternates every turn |
| Objective control tracking | ✅ | Majority-adjacent rule |
| Objective level escalation | ✅ | Levels 1–4, escalates every 2 turns |
| Hit sequence (normal units) | ✅ | Normal → Suppressed → Destroyed |
| Hit sequence (Armor) | ✅ | Armor absorbs 1 hit |
| Hit sequence (Heavy Armor) | ✅ | Armor absorbs 2 hits |
| Terrain placement restrictions | ✅ | Water = Naval only, Forest = no Tanks, etc. |
| Firebase multiplayer | ✅ | Create/Join game codes, real-time sync |
| P2 board flip + direction | ✅ | P2 sees board from their side; engine and display both correct |
| Card preview on hover | ✅ | Hovering board tile with unit shows card ability text |
| Deck builder | ❌ | 4 hardcoded starter decks only |
| GitHub Pages deploy | ✅ | Live at github.com/Shonetronic/Signal |

---

## Keywords (8 in Set 1)

| Keyword | Status | Notes |
|---|---|---|
| Guard | ✅ | Attackers must target Guard units first; bypassed when Suppressed |
| Armor | ✅ | Absorbs 1 hit before Suppressed |
| Heavy Armor | ✅ | Absorbs 2 hits before Suppressed |
| Double Attack | ✅ | Auto-stays in targeting mode after first attack; nerfed -2 total stats across all DA cards |
| Bombard | ✅ | Attacks any enemy in same row or column; bypasses Guard |
| Breakthrough | ❌ | Not implemented in combat logic |
| Inspire | ❌ | Not implemented |
| Airborne | ❌ | Not implemented (should allow placement on any terrain) |

---

## Objectives (8 in Set 1)

| Objective | Status | Notes |
|---|---|---|
| Factory (26) | ✅ | L1–2 fuel; L3–4 buff Tanks + fuel; L4 HQ damage |
| Airfield (27) | ⚠️ | L1 Aircraft bonus **not automated** (log message only); L2–4 HQ damage ✅ |
| Supply Depot (28) | ✅ | Fuel per level; draw at L3+; HQ damage at L4 |
| Bridge (29) | ❌ | "Return unit to hand" not automated (log message only) |
| Radar Station (30) | ❌ | "Look at opponent's hand" not automated (log message only) |
| City (31) | ✅ | Adjacent Infantry gain Guard + side bonus per level |
| Artillery Position (32) | ⚠️ | HQ damage ✅; L2/L4 "deal 1 hit to enemy" **not automated** |
| Fortification (33) | ✅ | Adjacent units gain Armor; side bonus L3+; HQ damage L4 |

---

## Commands (20 in current card list)

| Card | ID | Status | Notes |
|---|---|---|---|
| Artillery Barrage | 16 | ✅ | Targeted — strips Armor + Suppresses any enemy |
| Blitzkrieg Order | 17 | ✅ | Targeted — selected Tank attacks immediately |
| Field Medic | 18 | ✅ | Targeted — un-suppress 1 friendly |
| Tactical Withdrawal | 19 | ✅ | Targeted — return friendly to hand, draw 1 |
| Air Strike | 20 | ✅ | Targeted — 1 hit per friendly Aircraft on board |
| Coordinated Strike | 21 | ❌ | Needs multi-select UI (2 friendlies each attack) |
| Recon | 22 | ✅ | Instant — draw 3 |
| Smoke Screen | 49 | ✅ | Targeted — give Guard to 1 friendly |
| Improvised Position | 50 | ✅ | Targeted — give Armor to friendly with no base keyword |
| Rally Cry | 51 | ⚠️ | Instant — +1 all sides to ALL units (should be choose-2) |
| Forward Observer | 52 | ❌ | Needs deck-order UI (draw 3, keep 1, reorder 2) |
| Pincer Maneuver | 53 | ❌ | Needs multi-select + constraint (2 units on opposite sides) |
| Last Stand | 54 | ✅ | Targeted — un-suppress + give Guard |
| Dig In | 74 | ✅ | Targeted — Guard + Armor to unit on controlled objective |
| Hold Position | 75 | ✅ | Instant — all friendly units adjacent to controlled objectives gain Armor |
| Industrial Surge | 76 | ✅ | Instant — +2 Fuel at start of next turn |
| Overrun | 73 | ✅ | Instant — each Suppress/Destroy this turn deals +1 HQ damage |
| Combined Arms Doctrine | 78 | ✅ | Instant — clear all Suppression; +2 HQ per unit cleared |
| Entrench | 80 | ✅ | Instant — all friendly Infantry +2 sides this turn |
| Suppressing Fire | 79 | ✅ | Targeted — 1 hit per friendly Infantry on board |

---

## Missions (9 in current card list)

| Card | ID | Status | Notes |
|---|---|---|---|
| Hold the Line | 23 | ✅ | Control all objectives at end of turn → +5 HQ |
| Deep Strike | 24 | ✅ | Friendly adjacent to 2+ enemies → 2 HQ damage |
| Blitz Assault | 25 | ✅ | 2+ kills this turn → draw 2 + 1 Fuel |
| Armored Spearhead | 55 | ✅ | Instant on play — next Tank costs 2 less Fuel |
| Total Air Superiority | 56 | ✅ | Kill with Aircraft → 2 HQ damage |
| Fortify the Line | 57 | ✅ | Control 2+ objectives at end of turn → un-suppress 1 unit + Armor |
| Encirclement | 58 | ✅ | Enemy surrounded on 2+ sides → 1 hit to that enemy |
| Total Onslaught | 81 | ✅ | 3+ total kills this match → 2 HQ damage |
| Overwhelming Force | 84 | ✅ | Kill with Heavy Armor unit → 2 HQ damage |

---

## Maps (5 designed, all selectable)

All maps render correctly with terrain and objective slots. Terrain restrictions enforce placement rules.

| Map | Status |
|---|---|
| Normandy | ✅ |
| Stalingrad | ✅ |
| El Alamein | ✅ |
| Ardennes | ✅ |
| Kursk | ✅ |

---

## Known workarounds / prototype shortcuts

- **Rally Cry**: buffs all friendly units, not choose-2 as designed. Logged in play.
- **Artillery Position L2/L4**: "deal 1 hit" prints to log but players must resolve manually.
- **Bridge all levels**: "return unit to hand" prints to log but players must resolve manually.
- **Airfield L1**: "Aircraft attack twice on placement" prints to log but players must resolve manually.
- **Factory L2**: "next Tank costs 1 less" not implemented (Armored Spearhead mission covers similar ground).
