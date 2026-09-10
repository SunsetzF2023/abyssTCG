// ============================================================
// Autobattler UI — AbyssTCG
//
// Renders the autobattler game state to DOM and handles
// player interactions during the shop phase.
// ============================================================

import { createGame, resolveCombatPhase, getStandings } from './game.js';
import {
  reroll, buyPiece, moveMinion, sellPiece, buyXP, autoMerge,
  maxBoardSize, calculateIncome, getLevelInfo,
} from './shop.js';
import { RACE_INFO } from './pieces.js';

let game = null;
let selectedMinion = null; // uid of selected bench/board minion for moving

// ─── Screen management ────────────────────────────────────────

const abScreen = () => document.getElementById('screen-autobattler');

export function startAutobattler() {
  game = createGame('你', Date.now());
  selectedMinion = null;
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  abScreen().classList.remove('hidden');
  render();
}

export function isAutobattlerActive() {
  return game !== null;
}

export function exitAutobattler() {
  game = null;
}

// ─── Rendering ────────────────────────────────────────────────

function render() {
  if (!game) return;
  renderTopbar();
  renderStandings();
  renderBoards();
  renderBench();
  renderShop();
  renderPlayerInfo();

  if (game.phase === 'combat' || game.phase === 'gameover') {
    renderCombatResults();
  }
}

function renderTopbar() {
  document.getElementById('ab-round').textContent = `第 ${game.round} 回合`;
  const phaseText = game.phase === 'shop' ? '🛒 准备阶段' :
                    game.phase === 'combat' ? '⚔️ 战斗阶段' :
                    '🏆 游戏结束';
  document.getElementById('ab-phase').textContent = phaseText;
}

function renderStandings() {
  const container = document.getElementById('ab-standings');
  const standings = getStandings(game);
  container.innerHTML = standings.map((s) => {
    const hpColor = s.hp > 20 ? '#5a9e5a' : s.hp > 10 ? '#e0a040' : '#e0574a';
    return `
      <div class="ab-standing ${!s.alive ? 'dead' : ''} ${!s.isAI ? 'me' : ''}">
        <span class="ab-stand-name">${s.name}</span>
        <span class="ab-stand-hp" style="color:${hpColor}">❤️${s.hp}</span>
        <span class="ab-stand-info">Lv${s.level} ${s.boardSize}棋</span>
      </div>
    `;
  }).join('');
}

function renderBoards() {
  const playerBoard = document.getElementById('ab-player-board');
  const enemyBoard = document.getElementById('ab-enemy-board');
  const player = game.players[0];

  playerBoard.innerHTML = player.board.map((m) => minionCard(m, true)).join('');
  enemyBoard.innerHTML = '';

  // During combat, show the opponent's board
  if (game.phase === 'combat' && game.battles.length > 0) {
    const myBattle = game.battles.find((b) => b.player1 === player.name || b.player2 === player.name);
    if (myBattle && !myBattle.ghost) {
      // Show enemy board from the battle result (pre-combat snapshot)
      // We don't have the pre-combat enemy board stored, so show a message
      enemyBoard.innerHTML = '<div class="ab-combat-msg">战斗已结算</div>';
    }
  }
}

function minionCard(m, isPlayer) {
  const race = RACE_INFO[m.race] || { icon: '', color: '#888' };
  const stars = '⭐'.repeat(m.star);
  const abilityTag = m.ability ? abilityLabel(m.ability) : '';
  const selected = selectedMinion === m.uid ? 'selected' : '';
  return `
    <div class="ab-minion ${selected}" data-uid="${m.uid}" data-side="${isPlayer ? 'player' : 'enemy'}"
         style="border-color:${race.color}">
      <div class="ab-minion-stars">${stars}</div>
      <div class="ab-minion-icon">${race.icon}</div>
      <div class="ab-minion-name">${m.name}</div>
      ${abilityTag ? `<div class="ab-minion-ability">${abilityTag}</div>` : ''}
      <div class="ab-minion-stats">
        <span class="atk">⚔️${m.attack}</span>
        <span class="hp">❤️${m.health}</span>
      </div>
      ${m.divineShield ? '<div class="ab-shield">🛡️</div>' : ''}
    </div>
  `;
}

function abilityLabel(ability) {
  const labels = {
    taunt: '嘲讽',
    cleave: '顺劈',
    poison: '剧毒',
    enrage: '激怒',
    divineShield: '圣盾',
    deathrattle: '亡语',
  };
  return labels[ability.type] || ability.type;
}

function renderBench() {
  const container = document.getElementById('ab-bench');
  const player = game.players[0];
  container.innerHTML = player.bench.map((m) => minionCard(m, true)).join('');
}

function renderShop() {
  const container = document.getElementById('ab-shop');
  const player = game.players[0];
  const isShopPhase = game.phase === 'shop';

  container.innerHTML = player.shop.map((piece, i) => {
    const race = RACE_INFO[piece.race] || { icon: '', color: '#888' };
    const canAfford = player.gold >= piece.tier;
    return `
      <div class="ab-shop-piece ${!canAfford ? 'unaffordable' : ''}" data-index="${i}"
           style="border-color:${race.color}">
        <div class="ab-shop-cost">${piece.tier}💰</div>
        <div class="ab-shop-icon">${race.icon}</div>
        <div class="ab-shop-name">${piece.name}</div>
        <div class="ab-shop-stats">⚔️${piece.attack} ❤️${piece.health}</div>
        ${piece.ability ? `<div class="ab-shop-ability">${abilityLabel(piece.ability)}</div>` : ''}
      </div>
    `;
  }).join('');

  // Disable buttons if not shop phase
  document.getElementById('ab-reroll').disabled = !isShopPhase || player.gold < 1;
  document.getElementById('ab-levelup').disabled = !isShopPhase || player.gold < 4 || player.level >= 6;
  document.getElementById('ab-ready').disabled = !isShopPhase;
}

function renderPlayerInfo() {
  const player = game.players[0];
  const income = calculateIncome(player);
  const levelInfo = getLevelInfo(player.level);
  document.getElementById('ab-player-info').innerHTML = `
    <span class="ab-gold">💰 ${player.gold}</span>
    <span class="ab-hp">❤️ ${player.hp}</span>
    <span class="ab-level">Lv ${player.level} (${player.xp}/${levelInfo.xpNeeded === Infinity ? 'MAX' : levelInfo.xpNeeded} XP)</span>
    <span class="ab-income">下回合收入: ${income.total}💰</span>
    <span class="ab-board-count">棋盘: ${player.board.length}/${maxBoardSize(player.level)}</span>
  `;
}

function renderCombatResults() {
  const logBox = document.getElementById('ab-combat-log');
  logBox.classList.remove('hidden');

  const player = game.players[0];
  const myBattle = game.battles.find((b) => b.player1 === player.name || b.player2 === player.name);

  let html = '';
  if (myBattle) {
    if (myBattle.ghost) {
      html = `<div class="ab-result">👻 轮空，无战斗</div>`;
    } else {
      const won = (myBattle.result.winner === 'attacker' && myBattle.player1 === player.name) ||
                  (myBattle.result.winner === 'defender' && myBattle.player2 === player.name);
      const draw = myBattle.result.winner === 'draw';
      const dmg = myBattle.result.damageDealt;
      if (draw) {
        html = `<div class="ab-result draw">🤝 平局！双方无伤害</div>`;
      } else if (won) {
        html = `<div class="ab-result win">🎉 胜利！对敌方造成 ${dmg} 点伤害</div>`;
      } else {
        html = `<div class="ab-result lose">💀 失败！受到 ${dmg} 点伤害</div>`;
      }
      if (myBattle.result.survivors.length > 0) {
        html += `<div class="ab-survivors">存活: ${myBattle.result.survivors.map((s) => `${s.name}⭐${s.star}`).join(', ')}</div>`;
      }
    }
  }

  // Show all battle results
  html += '<div class="ab-all-results">';
  for (const b of game.battles) {
    if (b.ghost) continue;
    const winner = b.result.winner === 'attacker' ? b.player1 : b.player2;
    const loser = b.result.winner === 'attacker' ? b.player2 : b.player1;
    if (b.result.winner === 'draw') {
      html += `<div class="ab-mini-result">${b.player1} 🤝 ${b.player2}</div>`;
    } else {
      html += `<div class="ab-mini-result">${winner} ➤ ${loser} (${b.result.damageDealt}伤害)</div>`;
    }
  }
  html += '</div>';

  logBox.innerHTML = html;

  if (game.phase === 'gameover') {
    setTimeout(() => {
      const text = game.winner && game.winner.name === player.name ? '🎉 你赢了！' :
                   game.winner ? `💀 ${game.winner.name} 获胜` : '游戏结束';
      showAbGameOver(text);
    }, 500);
  }
}

function showAbGameOver(text) {
  document.getElementById('game-over-text').textContent = text;
  document.getElementById('game-over-overlay').classList.remove('hidden');
}

// ─── Event handling ───────────────────────────────────────────

export function setupAutobattlerEvents() {
  // Back button
  document.getElementById('ab-back').addEventListener('click', () => {
    exitAutobattler();
    document.getElementById('screen-autobattler').classList.add('hidden');
    document.getElementById('screen-menu').classList.remove('hidden');
  });

  // Shop piece click — buy
  document.getElementById('ab-shop').addEventListener('click', (e) => {
    if (!game || game.phase !== 'shop') return;
    const pieceEl = e.target.closest('.ab-shop-piece');
    if (!pieceEl) return;
    const index = parseInt(pieceEl.dataset.index, 10);
    if (buyPiece(game.players[0], index)) {
      autoMerge(game.players[0]);
      render();
    }
  });

  // Reroll
  document.getElementById('ab-reroll').addEventListener('click', () => {
    if (!game || game.phase !== 'shop') return;
    if (reroll(game.players[0])) {
      render();
    }
  });

  // Level up
  document.getElementById('ab-levelup').addEventListener('click', () => {
    if (!game || game.phase !== 'shop') return;
    if (buyXP(game.players[0])) {
      render();
    }
  });

  // Ready
  document.getElementById('ab-ready').addEventListener('click', () => {
    if (!game || game.phase !== 'shop') return;
    game.players[0].ready = true;
    autoMerge(game.players[0]);
    resolveCombatPhase(game);
    render();
    // After viewing results, start next round
    if (game.phase === 'shop') {
      // Already advanced — just re-render
    }
  });

  // Bench/board minion click — select for moving
  document.getElementById('ab-bench').addEventListener('click', (e) => {
    if (!game || game.phase !== 'shop') return;
    const minionEl = e.target.closest('.ab-minion');
    if (!minionEl) return;
    const uid = minionEl.dataset.uid;
    if (selectedMinion === uid) {
      // Deselect and try to move to board
      if (moveMinion(game.players[0], uid, true)) {
        autoMerge(game.players[0]);
      }
      selectedMinion = null;
    } else {
      selectedMinion = uid;
    }
    render();
  });

  document.getElementById('ab-player-board').addEventListener('click', (e) => {
    if (!game || game.phase !== 'shop') return;
    const minionEl = e.target.closest('.ab-minion');
    if (!minionEl) {
      // Clicked empty board area — move selected bench minion here
      if (selectedMinion) {
        if (moveMinion(game.players[0], selectedMinion, true)) {
          autoMerge(game.players[0]);
        }
        selectedMinion = null;
        render();
      }
      return;
    }
    const uid = minionEl.dataset.uid;
    if (selectedMinion === null) {
      // Select this board minion (to move back to bench)
      selectedMinion = uid;
      render();
    } else if (selectedMinion === uid) {
      // Deselect
      selectedMinion = null;
      render();
    } else {
      // Try to move selected to bench, then this one to board
      // For simplicity: if selected is on bench, move it to board
      const player = game.players[0];
      const onBench = player.bench.find((m) => m.uid === selectedMinion);
      if (onBench) {
        if (moveMinion(player, selectedMinion, true)) {
          autoMerge(player);
        }
      } else {
        // Both on board — swap (TODO) or move selected back to bench
        if (moveMinion(player, selectedMinion, false)) {
          autoMerge(player);
        }
      }
      selectedMinion = null;
      render();
    }
  });

  // Right-click to sell
  document.getElementById('ab-bench').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!game || game.phase !== 'shop') return;
    const minionEl = e.target.closest('.ab-minion');
    if (!minionEl) return;
    const uid = minionEl.dataset.uid;
    if (sellPiece(game.players[0], uid)) {
      render();
    }
  });

  document.getElementById('ab-player-board').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!game || game.phase !== 'shop') return;
    const minionEl = e.target.closest('.ab-minion');
    if (!minionEl) return;
    const uid = minionEl.dataset.uid;
    if (sellPiece(game.players[0], uid)) {
      render();
    }
  });
}
