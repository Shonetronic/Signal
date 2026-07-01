import { CARD_BY_ID } from './cards.js';
import { getKeywords, maxArmorHits } from './state.js';
import { getTerrain } from './maps.js';

const TERRAIN_SHORT = { plains: 'P', forest: 'F', water: 'W', desert: 'D', city: 'C' };

// ── Board rendering ───────────────────────────────────────────────────────────

// Render the 4x4 board from state into the #board element.
// selectedTileKey: tile currently selected/highlighted (string or null)
// validDropKeys: Set of tile keys where the selected hand card can be placed (or null)
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

      // Terrain type
      const terrainType = getTerrain(state.mapId, r, c);
      tile.classList.add(`terrain-${terrainType}`);
      const tLbl = document.createElement('div');
      tLbl.className = 'terrain-label';
      tLbl.textContent = TERRAIN_SHORT[terrainType] ?? terrainType[0].toUpperCase();
      tile.appendChild(tLbl);

      // Objective label + tooltip
      if (obj) {
        tile.classList.add('objective-tile');
        const objCard = CARD_BY_ID[obj.cardId];

        // Small corner label
        const ctrl = obj.controller;
        const ctrlTag = ctrl ? ` [${ctrl.toUpperCase()}]` : '';
        const lbl = document.createElement('div');
        lbl.className = 'objective-label';
        lbl.textContent = `${objCard?.name ?? '?'} L${obj.level}${ctrlTag}`;
        tile.appendChild(lbl);

        // Hover tooltip: all 4 levels with current one highlighted
        if (objCard) {
          const tooltip = document.createElement('div');
          tooltip.className = 'objective-tooltip';
          // Position left or right based on column to stay on screen
          if (c >= 2) { tooltip.style.right = '100px'; tooltip.style.left = 'auto'; }
          else         { tooltip.style.left  = '100px'; tooltip.style.right = 'auto'; }

          const ctrlLabel = ctrl
            ? `<div class="obj-ctrl ${ctrl}">${ctrl.toUpperCase()} CONTROLS</div>`
            : `<div class="obj-ctrl neutral">NEUTRAL</div>`;

          const levels = [objCard.l1, objCard.l2, objCard.l3, objCard.l4];
          const levelHtml = levels.map((eff, i) => {
            const isCurrent = (i + 1) === obj.level;
            return `<div class="obj-tt-level${isCurrent ? ' current' : ''}">
              <span class="obj-tt-lnum">L${i+1}</span> ${eff ?? '—'}
            </div>`;
          }).join('');

          tooltip.innerHTML = `<div class="obj-tt-name">${objCard.name}</div>${ctrlLabel}${levelHtml}`;
          tile.appendChild(tooltip);
        }
      }

      // Unit on tile
      if (unit) {
        // Destroyed units are still shown (greyed out) so board state is clear
        tile.classList.add('has-unit');
        tile.appendChild(buildBoardCard(unit));
      } else if (validDropKeys?.has(key)) {
        tile.classList.add('valid-drop');
      }

      if (key === selectedTileKey) {
        tile.classList.add('highlight');
      }

      board.appendChild(tile);
    }
  }
}

function buildBoardCard(unit) {
  const card = CARD_BY_ID[unit.cardId];
  const el = document.createElement('div');
  const buffed = unit.tempSideBonus > 0 || (unit.tempKeywords?.length > 0) || (unit.grantedKeywords?.length > 0);
  el.className = `board-card ${unit.owner} ${unit.state}${buffed ? ' buffed' : ''}`;

  const kws = getKeywords(unit).join(', ');
  const bonus = unit.tempSideBonus || 0;
  const maxArmor = maxArmorHits(unit);
  const remaining = maxArmor - unit.armorHits;
  const armorPips = maxArmor > 0
    ? Array.from({ length: maxArmor }, (_, i) =>
        `<span class="armor-pip ${i < remaining ? 'full' : 'spent'}">◆</span>`
      ).join('')
    : '';

  if (card && card.type === 'unit') {
    el.innerHTML = `
      <div class="bc-name">${card.name}</div>
      <div class="bc-dirs">
        <div></div>
        <div>${card.n + bonus}</div>
        <div></div>
        <div>${card.w + bonus}</div>
        <div style="font-size:7px;color:#555">${card.cls[0]}</div>
        <div>${card.e + bonus}</div>
        <div></div>
        <div>${card.s + bonus}</div>
        <div></div>
      </div>
      ${kws ? `<div class="bc-keyword">${kws}</div>` : ''}
      ${armorPips ? `<div class="bc-armor">${armorPips}</div>` : ''}
      ${unit.state === 'suppressed' ? '<div class="bc-state">SUP</div>' : ''}
      ${unit.state === 'destroyed' ? '<div class="bc-state">DEAD</div>' : ''}
    `;
  } else {
    el.innerHTML = `<div class="bc-name">${card?.name ?? '?'}</div>`;
  }

  return el;
}

// ── Hand rendering ────────────────────────────────────────────────────────────

// Render a player's hand into the element with the given id.
// selectedCardId: cardId currently selected (or null)
export function renderHand(handCardIds, containerId, selectedCardId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  handCardIds.forEach(cardId => {
    const card = CARD_BY_ID[cardId];
    if (!card) return;

    const div = document.createElement('div');
    div.className = 'hand-card';
    if (cardId === selectedCardId) div.classList.add('selected');
    div.dataset.cardId = cardId;

    if (card.type === 'unit') {
      div.innerHTML = `
        <div class="hc-header">${card.name}</div>
        <div class="hc-cost">${card.cost} ⛽ <span style="font-size:9px;color:#888">AP${card.ap}</span></div>
        <div class="hc-type">${card.cls}</div>
        <div class="hc-dirs">
          <div></div><div>${card.n}</div><div></div>
          <div>${card.w}</div><div style="color:#444">·</div><div>${card.e}</div>
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
      // objective (shouldn't normally be in hand, but handle gracefully)
      div.innerHTML = `
        <div class="hc-header">${card.name}</div>
        <div class="hc-type">Objective</div>
      `;
    }

    el.appendChild(div);
  });
}

// ── HQ / fuel / turn display ──────────────────────────────────────────────────

// Update #p1-hq, #p2-hq, #p1-fuel, #p2-fuel, #turn-display.
export function renderHQ(state) {
  document.getElementById('p1-hq').textContent = state.p1.hq;
  document.getElementById('p2-hq').textContent = state.p2.hq;
  document.getElementById('p1-fuel').textContent = `${state.p1.fuel} / 6 Fuel`;
  document.getElementById('p2-fuel').textContent = `${state.p2.fuel} / 6 Fuel`;
  document.getElementById('turn-display').textContent =
    `Turn ${state.turn} — ${state.initiative.toUpperCase()} to play`;

  const p1Block = document.getElementById('stat-p1');
  const p2Block = document.getElementById('stat-p2');
  if (p1Block && p2Block) {
    p1Block.classList.toggle('active-turn', state.initiative === 'p1');
    p2Block.classList.toggle('active-turn', state.initiative === 'p2');
  }
}

// ── Log ───────────────────────────────────────────────────────────────────────

// Append an array of strings to #game-log and scroll to bottom.
export function appendLog(entries) {
  const log = document.getElementById('game-log');
  if (!log) return;
  entries.forEach(text => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    // Light markup: turn markers and win messages get extra class
    if (text.startsWith('---')) div.classList.add('turn-marker');
    if (text.includes('wins!')) div.classList.add('win-msg');
    if (text.startsWith('Placed')) div.classList.add('place-msg');
    div.textContent = text;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}
