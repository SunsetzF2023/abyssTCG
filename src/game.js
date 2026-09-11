// ============================================================
// UI wiring — AbyssTCG
//
// Click-based interaction (no drag & drop), same interaction
// philosophy as our other card game:
//   1. Click a hand card to select it.
//   2. If it needs a target, click a valid minion / hero next.
//   3. Click a ready minion on your board to select it as an
//      attacker, then click an enemy minion or the enemy hero.
// ============================================================

import { FACTIONS, getFaction } from './factions.js';
import { getCard } from './cards.js';
import { newGame, playCard, attack, endTurn, checkWin, requiresMinionTarget } from './engine.js';

let game = null;
let selectedHandIndex = null; // index into player's hand, while awaiting a target
let selectedAttackerUid = null;

const screens = {
  menu: document.getElementById('screen-menu'),
  battle: document.getElementById('screen-battle'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el?.classList.toggle('hidden', k !== name));
}

// ─── Menu screen: faction select ───

function renderMenu() {
  const grid = document.getElementById('faction-grid');
  grid.innerHTML = '';
  FACTIONS.forEach(f => {
    const el = document.createElement('div');
    el.className = 'faction-card';
    el.style.borderColor = f.color;
    el.innerHTML = `
      <div class="faction-icon" style="color:${f.color}">${f.icon}</div>
      <div class="faction-name">${f.name}</div>
      <div class="faction-blurb">${f.blurb}</div>
      ${f.hasArt ? '' : '<div class="faction-tag">插画待补</div>'}
    `;
    el.addEventListener('click', () => startGame(f.id));
    grid.appendChild(el);
  });
}

function startGame(playerFactionId) {
  const others = FACTIONS.filter(f => f.id !== playerFactionId);
  const aiFactionId = others[Math.floor(Math.random() * others.length)].id;
  game = newGame(playerFactionId, aiFactionId);
  selectedHandIndex = null;
  selectedAttackerUid = null;
  showScreen('battle');
  renderBattle();
}

// ─── Battle screen ───

function renderBattle() {
  renderHero('ai');
  renderHero('player');
  renderBoard('ai');
  renderBoard('player');
  renderHand();
  renderLog();
  renderEndTurnButton();

  if (game.over) {
    setTimeout(() => {
      const text = game.winner === 'draw' ? '平局！' : (game.winner === 'player' ? '🎉 你赢了！' : '💀 你输了');
      showGameOver(text);
    }, 300);
  }
}

function renderHero(side) {
  const p = game[side];
  const faction = getFaction(p.factionId);
  document.getElementById(`hero-${side}-hp`).textContent = `${Math.max(0, p.heroHp)} / ${p.heroMaxHp}`;
  document.getElementById(`hero-${side}-mana`).textContent = `${p.manaCur} / ${p.manaMax}`;
  document.getElementById(`hero-${side}-faction`).textContent = `${faction.icon} ${faction.name}`;
  document.getElementById(`hero-${side}-deck`).textContent = `牌库: ${p.deck.length}`;
  const portrait = document.getElementById(`hero-${side}-portrait`);
  portrait.style.borderColor = faction.color;
  portrait?.classList.toggle('targetable', side === 'ai' && !!selectedAttackerUid);
  portrait?.classList.toggle('spell-targetable', false);
}

function renderBoard(side) {
  const container = document.getElementById(`board-${side}`);
  container.innerHTML = '';
  game[side].board.forEach(m => {
    const el = document.createElement('div');
    const isFriendlyReady = side === 'player' && m.canAttack && game.active === 'player';
    const isSelectedAttacker = m.uid === selectedAttackerUid;
    const isSpellTargetable = side !== null && selectedHandIndex !== null && requiresMinionTarget(getCard(game.player.hand[selectedHandIndex].cardId));
    const isAttackTargetable = side === 'ai' && selectedAttackerUid;
    el.className = 'minion' +
      (isFriendlyReady ? ' ready' : '') +
      (isSelectedAttacker ? ' selected' : '') +
      (m.tempBuff ? ' buffed' : '') +
      ((isSpellTargetable || isAttackTargetable) ? ' targetable' : '');
    el.innerHTML = `
      <div class="minion-name">${m.name}</div>
      <div class="minion-stats"><span class="atk">${m.attack}</span>/<span class="hp">${m.health}</span></div>
    `;
    el.addEventListener('click', () => onMinionClick(side, m.uid));
    container.appendChild(el);
  });
}

function renderHand() {
  const container = document.getElementById('hand-player');
  container.innerHTML = '';
  const p = game.player;
  p.hand.forEach((entry, idx) => {
    const card = getCard(entry.cardId);
    const el = document.createElement('div');
    const affordable = p.manaCur >= card.cost;
    el.className = 'card' + (card.art ? ' has-art' : '') + (!affordable ? ' unaffordable' : '') + (idx === selectedHandIndex ? ' selected' : '');
    el.style.setProperty('--faction-color', getFaction(card.faction).color);
    if (card.art) el.style.backgroundImage = `url('assets/cards/${card.art}')`;
    el.innerHTML = `
      <div class="card-cost">${card.cost}</div>
      <div class="card-body">
        <div class="card-name">${card.name}</div>
        ${card.type === 'minion'
          ? `<div class="card-mini-stats"><span class="atk">${card.attack}</span>/<span class="hp">${card.health}</span></div>${card.text ? `<div class="card-text">${card.text}</div>` : ''}`
          : `<div class="card-text">${card.text}</div>`}
      </div>
    `;
    el.addEventListener('click', () => onHandCardClick(idx));
    container.appendChild(el);
  });
}

function renderLog() {
  const box = document.getElementById('log-box');
  box.innerHTML = game.log.slice(-40).map(l => `<div class="log-line ${l.cls}">${l.text}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function renderEndTurnButton() {
  const btn = document.getElementById('btn-end-turn');
  btn.disabled = game.active !== 'player' || game.over;
}

// ─── Interaction ───

function onHandCardClick(idx) {
  if (game.active !== 'player' || game.over) return;
  const card = getCard(game.player.hand[idx].cardId);
  if (game.player.manaCur < card.cost) return;

  selectedAttackerUid = null;

  if (!requiresMinionTarget(card)) {
    playCard(game, 'player', idx, null);
    selectedHandIndex = null;
    afterPlayerAction();
    return;
  }
  // Needs a target — wait for a minion click.
  selectedHandIndex = (selectedHandIndex === idx) ? null : idx;
  renderBattle();
}

function onMinionClick(side, minionUid) {
  if (game.active !== 'player' || game.over) return;

  // Case 1: resolving a targeted spell from hand.
  if (selectedHandIndex !== null) {
    const err = playCard(game, 'player', selectedHandIndex, minionUid);
    selectedHandIndex = null;
    if (!err) afterPlayerAction();
    else renderBattle();
    return;
  }

  // Case 2: picking / using an attacker.
  if (side === 'player') {
    const m = game.player.board.find(x => x.uid === minionUid);
    if (m && m.canAttack) {
      selectedAttackerUid = (selectedAttackerUid === minionUid) ? null : minionUid;
      renderBattle();
    }
    return;
  }

  // Case 3: attacking an enemy minion with the selected attacker.
  if (side === 'ai' && selectedAttackerUid) {
    const err = attack(game, 'player', selectedAttackerUid, minionUid);
    selectedAttackerUid = null;
    if (err) { renderBattle(); return; }
    afterPlayerAction();
  }
}

function onHeroClick(side) {
  if (game.active !== 'player' || game.over) return;
  if (side === 'ai' && selectedAttackerUid) {
    attack(game, 'player', selectedAttackerUid, 'hero');
    selectedAttackerUid = null;
    afterPlayerAction();
  }
}

function afterPlayerAction() {
  checkWin(game);
  renderBattle();
}

function onEndTurnClick() {
  if (game.active !== 'player' || game.over) return;
  selectedHandIndex = null;
  selectedAttackerUid = null;
  endTurn(game);
  renderBattle();
}

function showGameOver(text) {
  const overlay = document.getElementById('game-over-overlay');
  overlay?.classList.remove('hidden');
  document.getElementById('game-over-text').textContent = text;
}

function backToMenu() {
  document.getElementById('game-over-overlay')?.classList.add('hidden');
  showScreen('menu');
  renderMenu();
}

// ─── Boot ───

document.getElementById('btn-end-turn').addEventListener('click', onEndTurnClick);
document.getElementById('hero-ai-portrait').addEventListener('click', () => onHeroClick('ai'));
document.getElementById('btn-play-again').addEventListener('click', backToMenu);

renderMenu();
showScreen('menu');
