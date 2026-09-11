// ============================================================
// Autobattler UI — AbyssTCG
//
// Renders the autobattler game state to DOM and handles
// player interactions during the shop phase.
//
// Board layout: 6 fixed slots in two rows of three.
//   front row: positions 0, 1, 2
//   back row:  positions 3, 4, 5
// Drag and drop is the primary way to arrange minions.
// ============================================================

import { createGameFromRoom, resolveCombatPhase, getStandings, advanceToNextRound } from './game.js';
import {
  createRoom, addAISlot, fillWithAI, removeSlot, canStartGame, startGame, getSlotLabel,
} from './room.js';
import {
  reroll, buyPiece, sellPiece, upgradeShop, autoMerge, placeMinion, moveToBench,
  calculateIncome, getLevelInfo, BUY_COST,
} from './shop.js';
import { RACE_INFO } from './pieces.js';
import { playBattleAnimation } from './animator.js';
import { broadcastGameState, sendPlayerAction, subscribeToGameActions } from '../supabase-game.js';

let game = null;
let draggedUid = null;
let draggedSource = null; // 'bench' or board position number
let selectedShopIndex = null;
let dragJustEnded = false;
let dragResetTimer = null;
let unsubscribeActions = null;

// ─── Screen management ────────────────────────────────────────

const abScreen = () => document.getElementById('screen-autobattler');

export function startAutobattler() {
  const room = createRoom('你');
  game = {
    phase: 'lobby',
    round: 0,
    room,
    host: room.host.name,
  };
  battleAnimating = false;
  draggedUid = null;
  draggedSource = null;
  document.querySelectorAll('.screen').forEach((s) => s?.classList.add('hidden'));
  abScreen()?.classList.remove('hidden');
  render();
}

export function isAutobattlerActive() {
  return game !== null;
}

export function exitAutobattler() {
  game = null;
  if (unsubscribeActions) {
    unsubscribeActions();
    unsubscribeActions = null;
  }
}

export function startPvpGame(newGame) {
  game = newGame;
  battleAnimating = false;
  draggedUid = null;
  draggedSource = null;
  document.querySelectorAll('.screen').forEach((s) => s?.classList.add('hidden'));
  abScreen()?.classList.remove('hidden');

  if (unsubscribeActions) {
    unsubscribeActions();
    unsubscribeActions = null;
  }
  if (game?.isOnline && game?.isHost && game?.roomId) {
    unsubscribeActions = subscribeToGameActions(game.roomId, applyRemoteAction);
  }

  render();
}

function applyRemoteAction(action) {
  if (!game || !game.isHost) return;
  const player = game.players[action.playerIndex];
  if (!player) return;

  switch (action.type) {
    case 'buy':
      if (buyPiece(player, action.shopIndex)) autoMerge(player);
      break;
    case 'sell':
      sellPiece(player, action.uid);
      break;
    case 'moveToBench':
      if (moveToBench(player, action.pos)) {
        autoMerge(player);
      }
      break;
    case 'reroll':
      reroll(player);
      break;
    case 'levelup':
      upgradeShop(player);
      break;
    case 'move':
      if (placeMinion(player, action.uid, action.targetPos)) autoMerge(player);
      break;
    case 'ready':
      player.ready = true;
      autoMerge(player);
      if (game.players.every((p) => p.ready)) {
        resolveCombatPhase(game);
      }
      break;
    default:
      console.warn('[pvp] unknown action:', action.type);
  }

  render();
}

// ─── Rendering ───────────────────────────────────────────────

function render() {
  if (!game) return;
  renderTopbar();

  if (game.phase === 'lobby') {
    renderLobby();
    return;
  }

  document.getElementById('ab-lobby')?.classList.add('hidden');
  document.getElementById('ab-battle-area')?.classList.remove('hidden');

  renderStandings();

  if (game.phase === 'combat') {
    // During combat animation, only show the battle boards (handled by animator)
    document.getElementById('ab-bench-area')?.classList.add('hidden');
    document.getElementById('ab-shop-area')?.classList.add('hidden');
    document.getElementById('ab-player-info')?.classList.add('hidden');
    startCombatAnimation();
    broadcastIfHost();
    return;
  }

  document.getElementById('ab-bench-area')?.classList.remove('hidden');
  document.getElementById('ab-shop-area')?.classList.remove('hidden');
  document.getElementById('ab-player-info')?.classList.remove('hidden');
  renderBoards();
  renderBench();
  renderShop();
  renderPlayerInfo();

  if (game.phase === 'combat' || game.phase === 'gameover') {
    renderCombatResults();
  }

  broadcastIfHost();
}

function broadcastIfHost() {
  if (game?.isOnline && game?.isHost) {
    broadcastGameState(game).catch((e) => console.error('[pvp] broadcast failed:', e));
  }
}

function renderLobby() {
  const lobby = document.getElementById('ab-lobby');
  const room = game.room;
  if (!lobby || !room) return;

  document.getElementById('ab-battle-area')?.classList.add('hidden');
  document.getElementById('ab-bench-area')?.classList.add('hidden');
  document.getElementById('ab-shop-area')?.classList.add('hidden');
  document.getElementById('ab-player-info')?.classList.add('hidden');
  document.getElementById('ab-combat-log')?.classList.add('hidden');
  document.getElementById('ab-combat-controls')?.classList.add('hidden');
  lobby?.classList.remove('hidden');

  const slotsHtml = room.slots.map((slot) => {
    const label = getSlotLabel(slot);
    const isHostSlot = slot.index === 0;
    return `
      <div class="ab-lobby-slot" data-index="${slot.index}">
        <span class="ab-lobby-slot-index">${slot.index + 1}</span>
        <span class="ab-lobby-slot-name">${label}</span>
        ${!isHostSlot ? `<button class="ab-lobby-kick" data-index="${slot.index}">踢出</button>` : ''}
      </div>
    `;
  }).join('');

  const controlsHtml = `
    <button id="ab-add-ai" class="btn-ab">添加 AI</button>
    <button id="ab-fill-ai" class="btn-ab">一键补全 AI</button>
    <button id="ab-start-game" class="btn-ab ${canStartGame(room) ? '' : 'disabled'}" ${canStartGame(room) ? '' : 'disabled'}>开始游戏</button>
  `;

  lobby.innerHTML = `
    <h3>8 人房间</h3>
    <div class="ab-lobby-slots">${slotsHtml}</div>
    <div class="ab-lobby-controls">${controlsHtml}</div>
  `;

  document.getElementById('ab-add-ai').addEventListener('click', () => {
    const idx = room.slots.findIndex((s) => s.type === 'empty');
    if (idx !== -1) addAISlot(room, idx);
    render();
  });

  document.getElementById('ab-fill-ai').addEventListener('click', () => {
    fillWithAI(room);
    render();
  });

  document.getElementById('ab-start-game').addEventListener('click', () => {
    if (!canStartGame(room)) return;
    startGame(room);
    game = createGameFromRoom(room);
    render();
  });

  lobby.querySelectorAll('.ab-lobby-kick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      removeSlot(room, idx);
      render();
    });
  });
}

function renderTopbar() {
  document.getElementById('ab-round').textContent = game.phase === 'lobby' ? '房间' : `第 ${game.round} 回合`;
  const phaseText = game.phase === 'lobby' ? '🏠 房间大厅' :
                    game.phase === 'shop' ? '🛒 准备阶段' :
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
  const player = game.players[game.myPlayerIndex || 0];
  renderBoardRow('ab-player-front', player.board, 0, 3);
  renderBoardRow('ab-player-back', player.board, 3, 6);
  renderBench();

  // Enemy board: during combat show a compact summary
  const enemyFront = document.getElementById('ab-enemy-front');
  const enemyBack = document.getElementById('ab-enemy-back');
  enemyFront.innerHTML = '';
  enemyBack.innerHTML = '';

  if (game.phase === 'combat' && game.battles.length > 0) {
    const myBattle = game.battles.find((b) => b.player1 === player.name || b.player2 === player.name);
    if (myBattle && !myBattle.ghost) {
      const isAttacker = myBattle.player1 === player.name;
      document.getElementById('ab-player-name').textContent = player.name;
      document.getElementById('ab-enemy-name').textContent = isAttacker ? myBattle.player2 : myBattle.player1;
      const enemyBoard = isAttacker ? myBattle.result.defenderSurvivors : myBattle.result.attackerSurvivors;
      if (enemyBoard && enemyBoard.length > 0) {
        renderSnapshot(enemyFront, enemyBoard.slice(0, 3));
        renderSnapshot(enemyBack, enemyBoard.slice(3, 6));
      } else {
        enemyBack.innerHTML = '<div class="ab-combat-msg">战斗已结算</div>';
      }
    }
  } else {
    document.getElementById('ab-player-name').textContent = player.name;
    document.getElementById('ab-enemy-name').textContent = '敌方';
  }
}

function renderBoardRow(containerId, board, start, end) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = start; i < end; i++) {
    const m = board[i];
    const slot = document.createElement('div');
    slot.className = 'ab-board-slot';
    slot.dataset.pos = i;
    if (m) {
      slot.innerHTML = minionCard(m, true);
    }
    container.appendChild(slot);
  }
}

function renderSnapshot(container, minions) {
  container.innerHTML = minions.map((m) => m ? minionCard(m, false) : '').join('');
}

function minionCard(m, isPlayer, isDraggable = true) {
  const race = RACE_INFO[m.race] || { icon: '', color: '#888' };
  const stars = '⭐'.repeat(m.star);
  const abilityTag = m.ability ? abilityLabel(m.ability) : '';
  const dragAttr = isDraggable ? 'draggable="true"' : '';
  return `
    <div class="ab-minion" data-uid="${m.uid}" data-side="${isPlayer ? 'player' : 'enemy'}"
         style="border-color:${race.color}" ${dragAttr}>
      <div class="ab-minion-stars">${stars}</div>
      <div class="ab-minion-icon">${race.icon}</div>
      <div class="ab-minion-name">${m.name}</div>
      ${abilityTag ? `<div class="ab-minion-ability">${abilityTag}</div>` : ''}
      <div class="ab-minion-stats">
        <span class="atk">⚔️${m.attack}</span>
        <span class="hp">❤️${m.health}</span>
      </div>
      ${m.shield ? '<div class="ab-shield">🛡️</div>' : ''}
    </div>
  `;
}

function abilityLabel(ability) {
  const labels = {
    taunt: '嘲讽',
    cleave: '顺劈',
    pierce: '贯穿',
    enrage: '激怒',
    shield: '护盾',
    deathrattle: '亡语',
    grow: '成长',
    firstStrike: '先手',
    frenzy: '连击',
    onKill: '击杀',
    meditate: '冥想',
    battlecry: '入场',
  };
  return labels[ability.type] || ability.type;
}

function renderBench() {
  const container = document.getElementById('ab-bench');
  const player = game.players[game.myPlayerIndex || 0];
  container.innerHTML = player.bench.map((m) => minionCard(m, true)).join('');
}

function renderShop() {
  const container = document.getElementById('ab-shop');
  const player = game.players[game.myPlayerIndex || 0];
  const isShopPhase = game.phase === 'shop';
  const levelInfo = getLevelInfo(player.level);
  const upgradeCost = levelInfo.xpNeeded === Infinity ? 0 : Math.max(0, levelInfo.xpNeeded - player.xp);

  container.innerHTML = player.shop.map((piece, i) => {
    const race = RACE_INFO[piece.race] || { icon: '', color: '#888' };
    const canAfford = player.gold >= BUY_COST;
    return `
      <div class="ab-shop-piece ${!canAfford ? 'unaffordable' : ''}" data-index="${i}"
           style="border-color:${race.color}">
        <div class="ab-shop-cost">${BUY_COST}💰</div>
        <div class="ab-shop-icon">${race.icon}</div>
        <div class="ab-shop-name">${piece.name}</div>
        <div class="ab-shop-stats">⚔️${piece.attack} ❤️${piece.health}</div>
        ${piece.ability ? `<div class="ab-shop-ability">${abilityLabel(piece.ability)}</div>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('ab-reroll').disabled = !isShopPhase || player.gold < 1;
  const levelBtn = document.getElementById('ab-levelup');
  const canUpgrade = isShopPhase && player.level < 6 && player.gold >= upgradeCost;
  levelBtn.disabled = !canUpgrade;
  levelBtn.textContent = `⬆ 升级 (${upgradeCost}💰)`;
  document.getElementById('ab-ready').disabled = !isShopPhase;
}

function openShopDetail(index) {
  if (!game || game.phase !== 'shop') return;
  const piece = game.players[game.myPlayerIndex || 0].shop[index];
  if (!piece) return;
  selectedShopIndex = index;
  openDetailModal(piece, { shopIndex: index });
}

function openMinionDetail(minion) {
  if (!minion) return;
  selectedShopIndex = null;
  openDetailModal(minion, { owned: true });
}

function openDetailModal(item, options = {}) {
  const race = RACE_INFO[item.race] || { icon: '', color: '#888' };
  const content = document.getElementById('shop-detail-content');
  const buyBtn = document.getElementById('shop-detail-buy');

  content.innerHTML = `
    <div class="detail-icon" style="color:${race.color}">${race.icon}</div>
    <div class="detail-name" style="color:${race.color}">${item.name}</div>
    <div class="detail-race">${race.name} · ${'⭐'.repeat(item.star || item.tier || 1)} · ${item.attack}⚔️/${item.health}❤️</div>
    <div class="detail-stats">
      <span class="atk">⚔️ ${item.attack}</span>
      <span class="hp">❤️ ${item.health}</span>
    </div>
    ${item.ability ? `<div class="detail-ability"><strong>${abilityLabel(item.ability)}</strong><br>${item.description || ''}</div>` : '<div class="detail-ability">无特殊技能</div>'}
    <div class="detail-flavor">"${item.flavor || ''}"</div>
  `;

  if (options.shopIndex !== undefined) {
    const canAfford = game.players[game.myPlayerIndex || 0].gold >= BUY_COST;
    buyBtn.textContent = `购买 (${BUY_COST}💰)`;
    buyBtn.disabled = !canAfford;
    buyBtn?.classList.remove('hidden');
  } else {
    buyBtn?.classList.add('hidden');
  }
  document.getElementById('shop-detail-modal')?.classList.remove('hidden');
}

function closeShopDetail() {
  selectedShopIndex = null;
  document.getElementById('shop-detail-modal')?.classList.add('hidden');
}

function renderPlayerInfo() {
  const player = game.players[game.myPlayerIndex || 0];
  const nextRound = game.round + 1;
  const income = calculateIncome(nextRound);
  const levelInfo = getLevelInfo(player.level);
  const upgradeCost = levelInfo.xpNeeded === Infinity ? 0 : Math.max(0, levelInfo.xpNeeded - player.xp);
  const levelText = levelInfo.xpNeeded === Infinity
    ? `Lv MAX`
    : `Lv ${player.level} (升级还需 ${upgradeCost}💰)`;
  document.getElementById('ab-player-info').innerHTML = `
    <span class="ab-gold">💰 ${player.gold}</span>
    <span class="ab-hp">❤️ ${player.hp}</span>
    <span class="ab-level">${levelText}</span>
    <span class="ab-income">下回合收入: ${income}💰</span>
    <span class="ab-board-count">棋盘: ${player.board.filter(Boolean).length}/6</span>
  `;
}

function renderCombatResults() {
  const logBox = document.getElementById('ab-combat-log');
  logBox?.classList.remove('hidden');

  const player = game.players[game.myPlayerIndex || 0];
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

let battleAnimating = false;

function startCombatAnimation() {
  if (battleAnimating) return;
  const player = game.players[game.myPlayerIndex || 0];
  const me = player.id || player.name;
  const myBattle = game.battles.find((b) => b.player1Id === me || b.player2Id === me);

  if (!myBattle || myBattle.ghost) {
    onBattleAnimationDone();
    return;
  }

  battleAnimating = true;
  document.getElementById('ab-combat-log')?.classList.add('hidden');
  document.getElementById('ab-combat-controls')?.classList.add('hidden');

  const humanSide = myBattle.player1Id === me ? 'attacker' : 'defender';
  playBattleAnimation(myBattle.result, humanSide, onBattleAnimationDone);
}

function onBattleAnimationDone() {
  battleAnimating = false;
  document.getElementById('ab-combat-log')?.classList.remove('hidden');
  document.getElementById('ab-combat-controls')?.classList.remove('hidden');
  renderCombatResults();
}

function showAbGameOver(text) {
  document.getElementById('game-over-text').textContent = text;
  document.getElementById('game-over-overlay')?.classList.remove('hidden');
}

// ─── Drag and drop ───────────────────────────────────────────

function onDragStart(e) {
  if (!game || game.phase !== 'shop') return;
  const card = e.target.closest('.ab-minion');
  if (!card) return;
  if (dragResetTimer) clearTimeout(dragResetTimer);
  dragJustEnded = false;
  const uid = card.dataset.uid;
  const slot = e.target.closest('.ab-board-slot');
  draggedUid = uid;
  draggedSource = slot ? parseInt(slot.dataset.pos, 10) : 'bench';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', uid);
  card?.classList.add('dragging');
}

function onDragEnd(e) {
  const card = e.target.closest('.ab-minion');
  if (card) card?.classList.remove('dragging');
  draggedUid = null;
  draggedSource = null;
  if (dragResetTimer) clearTimeout(dragResetTimer);
  dragJustEnded = true;
  dragResetTimer = setTimeout(() => { dragJustEnded = false; }, 250);
}

function onDragOver(e) {
  if (!game || game.phase !== 'shop') return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const slot = e.target.closest('.ab-board-slot');
  if (slot) slot?.classList.add('drag-over');
}

function onDragLeave(e) {
  const slot = e.target.closest('.ab-board-slot');
  if (slot) slot?.classList.remove('drag-over');
}

function onDrop(e) {
  if (!game || game.phase !== 'shop') return;
  e.preventDefault();
  const slot = e.target.closest('.ab-board-slot');
  if (slot) slot?.classList.remove('drag-over');

  const bench = e.target.closest && e.target.closest('#ab-bench');
  const myIndex = game.myPlayerIndex || 0;
  const player = game.players[myIndex];

  if (bench) {
    if (typeof draggedSource === 'number') {
      if (game?.isOnline) {
        if (!game.isHost) {
          sendPlayerAction(game.roomId, { type: 'moveToBench', playerIndex: myIndex, pos: draggedSource });
        }
      } else if (moveToBench(player, draggedSource)) {
        autoMerge(player);
        render();
      }
    }
    dragJustEnded = true;
    if (dragResetTimer) clearTimeout(dragResetTimer);
    dragResetTimer = setTimeout(() => { dragJustEnded = false; }, 250);
    return;
  }

  if (!slot) return;
  const targetPos = parseInt(slot.dataset.pos, 10);
  if (draggedUid) {
    if (game?.isOnline) {
      if (!game.isHost) {
        sendPlayerAction(game.roomId, { type: 'move', playerIndex: myIndex, uid: draggedUid, targetPos });
      }
    } else if (placeMinion(player, draggedUid, targetPos)) {
      autoMerge(player);
      render();
    }
  }
  dragJustEnded = true;
  if (dragResetTimer) clearTimeout(dragResetTimer);
  dragResetTimer = setTimeout(() => { dragJustEnded = false; }, 250);
}

export function setupAutobattlerEvents() {
  // Back button
  document.getElementById('ab-back').addEventListener('click', () => {
    exitAutobattler();
    document.getElementById('screen-autobattler')?.classList.add('hidden');
    document.getElementById('screen-menu')?.classList.remove('hidden');
  });

  // Shop piece click — open detail modal
  document.getElementById('ab-shop').addEventListener('click', (e) => {
    if (!game || game.phase !== 'shop') return;
    const pieceEl = e.target.closest('.ab-shop-piece');
    if (!pieceEl) return;
    const index = parseInt(pieceEl.dataset.index, 10);
    openShopDetail(index);
  });

  // Modal close
  document.getElementById('shop-detail-close').addEventListener('click', closeShopDetail);
  document.querySelector('#shop-detail-modal .modal-backdrop').addEventListener('click', closeShopDetail);

  // Modal buy button
  document.getElementById('shop-detail-buy').addEventListener('click', () => {
    if (selectedShopIndex === null || !game || game.phase !== 'shop') return;
    const myIndex = game.myPlayerIndex || 0;
    if (game?.isOnline && !game?.isHost) {
      sendPlayerAction(game.roomId, { type: 'buy', playerIndex: myIndex, shopIndex: selectedShopIndex });
      closeShopDetail();
      return;
    }
    if (buyPiece(game.players[myIndex], selectedShopIndex)) {
      autoMerge(game.players[myIndex]);
      closeShopDetail();
      render();
    }
  });

  // Reroll
  document.getElementById('ab-reroll').addEventListener('click', () => {
    if (!game || game.phase !== 'shop') return;
    const myIndex = game.myPlayerIndex || 0;
    if (game?.isOnline && !game?.isHost) {
      sendPlayerAction(game.roomId, { type: 'reroll', playerIndex: myIndex });
      return;
    }
    if (reroll(game.players[myIndex])) {
      render();
    }
  });

  // Level up
  document.getElementById('ab-levelup').addEventListener('click', () => {
    if (!game || game.phase !== 'shop') return;
    const myIndex = game.myPlayerIndex || 0;
    if (game?.isOnline && !game?.isHost) {
      sendPlayerAction(game.roomId, { type: 'levelup', playerIndex: myIndex });
      return;
    }
    if (upgradeShop(game.players[myIndex])) {
      render();
    }
  });

  // Ready
  document.getElementById('ab-ready').addEventListener('click', () => {
    if (!game || game.phase !== 'shop') return;
    const myIndex = game.myPlayerIndex || 0;
    if (game?.isOnline && !game?.isHost) {
      sendPlayerAction(game.roomId, { type: 'ready', playerIndex: myIndex });
      return;
    }
    game.players[myIndex].ready = true;
    autoMerge(game.players[myIndex]);
    if (game.players.every((p) => p.ready)) {
      resolveCombatPhase(game);
    }
    render();
  });

  // Next round (after combat animation)
  document.getElementById('ab-next-round').addEventListener('click', () => {
    if (!game || game.phase !== 'combat') return;
    if (game?.isOnline && !game?.isHost) return;
    advanceToNextRound(game);
    render();
  });

  // Drag events on bench and board rows
  const bench = document.getElementById('ab-bench');
  bench.addEventListener('dragstart', onDragStart);
  bench.addEventListener('dragend', onDragEnd);
  bench.addEventListener('dragover', onDragOver);
  bench.addEventListener('drop', onDrop);

  for (const id of ['ab-player-front', 'ab-player-back']) {
    const row = document.getElementById(id);
    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragend', onDragEnd);
    row.addEventListener('dragover', onDragOver);
    row.addEventListener('dragleave', onDragLeave);
    row.addEventListener('drop', onDrop);
  }

  // Click to view minion details
  document.getElementById('ab-bench').addEventListener('click', (e) => {
    if (!game || game.phase !== 'shop' || dragJustEnded) return;
    const minionEl = e.target.closest('.ab-minion');
    if (!minionEl) return;
    const uid = minionEl.dataset.uid;
    const minion = game.players[game.myPlayerIndex || 0].bench.find((m) => m.uid === uid);
    openMinionDetail(minion);
  });

  for (const id of ['ab-player-front', 'ab-player-back']) {
    document.getElementById(id).addEventListener('click', (e) => {
      if (!game || game.phase !== 'shop' || dragJustEnded) return;
      const minionEl = e.target.closest('.ab-minion');
      if (!minionEl) return;
      const slot = e.target.closest('.ab-board-slot');
      if (!slot) return;
      const pos = parseInt(slot.dataset.pos, 10);
      const minion = game.players[game.myPlayerIndex || 0].board[pos];
      openMinionDetail(minion);
    });
  }

  // Right-click to sell
  document.getElementById('ab-bench').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!game || game.phase !== 'shop') return;
    const minionEl = e.target.closest('.ab-minion');
    if (!minionEl) return;
    const uid = minionEl.dataset.uid;
    const myIndex = game.myPlayerIndex || 0;
    if (game?.isOnline && !game?.isHost) {
      sendPlayerAction(game.roomId, { type: 'sell', playerIndex: myIndex, uid });
      return;
    }
    if (sellPiece(game.players[myIndex], uid)) {
      render();
    }
  });

  for (const id of ['ab-player-front', 'ab-player-back']) {
    document.getElementById(id).addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!game || game.phase !== 'shop') return;
      const minionEl = e.target.closest('.ab-minion');
      if (!minionEl) return;
      const slot = e.target.closest('.ab-board-slot');
      if (slot) {
        const pos = parseInt(slot.dataset.pos, 10);
        const myIndex = game.myPlayerIndex || 0;
        if (game?.isOnline && !game?.isHost) {
          sendPlayerAction(game.roomId, { type: 'moveToBench', playerIndex: myIndex, pos });
          return;
        }
        if (moveToBench(game.players[myIndex], pos)) {
          autoMerge(game.players[myIndex]);
          render();
        }
      }
    });
  }
}
