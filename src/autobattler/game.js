// ============================================================
// Game flow — AbyssTCG autobattler mode
//
// Orchestrates a full 8-player game:
//   1. Create 8 players (1 human + 7 AI)
//   2. Each round: income, shop, preparation, ready
//   3. Combat phase: random pairing, resolve battles, apply damage
//   4. Eliminate players at 0 HP
//   5. Last player standing wins
//
// Pure logic, no DOM access.
// ============================================================

import { createPlayer, startRound, autoMerge, getCombatBoard, upgradeShop, reroll, buyPiece, placeMinion, BUY_COST } from './shop.js';
import { resolveBattle } from './battle.js';
import { setSeed } from './shop.js';
import { SLOT_TYPE } from './room.js';

export const PLAYER_COUNT = 8;
export const MAX_ROUNDS = 30;
export const PREP_TIME_MS = 60000;

// ─── AI logic (simple greedy) ──────────────────────────────────

function aiShopPhase(player) {
  autoMerge(player);

  // Buy pieces if there's room
  for (let i = player.shop.length - 1; i >= 0; i--) {
    if (player.gold >= BUY_COST) {
      const totalPieces = player.board.filter(Boolean).length + player.bench.length;
      if (totalPieces < 12) { // 6 board + up to 6 bench reserve
        buyPiece(player, i);
        autoMerge(player);
      }
    }
  }

  // Place tanky pieces in front row (0-2), damage in back row (3-5)
  const fillSlots = () => {
    // Front row: highest health first
    const frontSlots = [0, 1, 2].filter((pos) => player.board[pos] === null);
    if (frontSlots.length > 0) {
      player.bench.sort((a, b) => (b.health + b.attack) - (a.health + a.attack));
      for (const pos of frontSlots) {
        const m = player.bench[0];
        if (!m) break;
        placeMinion(player, m.uid, pos);
      }
    }
    // Back row: highest attack first
    const backSlots = [3, 4, 5].filter((pos) => player.board[pos] === null);
    if (backSlots.length > 0) {
      player.bench.sort((a, b) => b.attack - a.attack);
      for (const pos of backSlots) {
        const m = player.bench[0];
        if (!m) break;
        placeMinion(player, m.uid, pos);
      }
    }
  };

  fillSlots();

  // Level up if possible and beneficial
  if (player.level < 6) {
    upgradeShop(player);
  }

  // Reroll if gold is plentiful
  if (player.gold >= 4) {
    reroll(player);
    for (let i = player.shop.length - 1; i >= 0; i--) {
      if (player.gold >= BUY_COST) {
        const total = player.board.filter(Boolean).length + player.bench.length;
        if (total < 12) {
          buyPiece(player, i);
          autoMerge(player);
        }
      }
    }
    fillSlots();
  }

  autoMerge(player);
  player.ready = true;
}

// ─── Game creation ─────────────────────────────────────────────

export function createGame(humanPlayerName = 'You', seed = Date.now()) {
  setSeed(seed);
  const players = [];
  players.push(createPlayer(humanPlayerName, false));
  const aiNames = ['暗影', '烈焰', '寒冰', '雷霆', '大地', '星辰', '虚空'];
  for (let i = 0; i < PLAYER_COUNT - 1; i++) {
    players.push(createPlayer(aiNames[i] || ('AI-' + i), true));
  }

  // Give everyone their first shop
  for (const p of players) {
    startRound(p, 1);
    if (p.isAI) {
      aiShopPhase(p);
    }
  }

  return {
    players,
    round: 1,
    phase: 'shop', // 'shop' | 'combat' | 'gameover'
    battles: [],   // results of current round
    log: [],
    winner: null,
    shopEndTime: Date.now() + PREP_TIME_MS,
  };
}

export function createGameFromRoom(room, seed = Date.now()) {
  setSeed(seed);
  const players = [];
  for (const slot of room.slots) {
    const isAI = slot.type !== SLOT_TYPE.PLAYER;
    const name = slot.name || (isAI ? 'AI' : 'Player');
    players.push(createPlayer(name, isAI));
  }

  // Give everyone their first shop
  for (const p of players) {
    startRound(p, 1);
    if (p.isAI) {
      aiShopPhase(p);
    }
  }

  return {
    players,
    round: 1,
    phase: 'shop',
    battles: [],
    log: [],
    winner: null,
    shopEndTime: Date.now() + PREP_TIME_MS,
  };
}

export function createGameFromOnlineRoom(room, myPlayerIndex, isHost, seed = Date.now()) {
  setSeed(seed);
  const players = [];
  for (let i = 0; i < 8; i++) {
    const slot = room[`slot_${i}`];
    const isAI = slot === 'AI_ROBOT';
    const isRemote = !isAI && i !== myPlayerIndex;
    const isMe = !isAI && i === myPlayerIndex;
    let name;
    if (isAI) name = `AI-${i}`;
    else if (isMe) name = '你';
    else name = `玩家#${slot.substring(0, 6)}`;
    const player = createPlayer(name, isAI, isRemote);
    if (!isAI) player.id = slot;
    players.push(player);
  }

  for (const p of players) {
    startRound(p, 1);
    if (p.isAI) {
      aiShopPhase(p);
    }
  }

  return {
    players,
    round: 1,
    phase: 'shop',
    battles: [],
    log: [],
    winner: null,
    shopEndTime: Date.now() + PREP_TIME_MS,
    isOnline: true,
    isHost,
    myPlayerIndex,
    roomId: room.id,
    host_id: room.host_id,
  };
}

// ─── Combat pairing ────────────────────────────────────────────

function roundRobinPairs(players, round) {
  const n = players.length;
  const r = (round - 1) % (n - 1);
  const fixed = n - 1;
  const order = [];
  for (let i = 0; i < fixed; i++) {
    order.push((i + r) % fixed);
  }
  const pairs = [];
  for (let i = 0; i < (fixed - 1) / 2; i++) {
    const a = order[i];
    const b = order[fixed - 1 - i];
    pairs.push([players[a], players[b]]);
  }
  const middle = order[(fixed - 1) / 2];
  pairs.push([players[middle], players[fixed]]);
  return pairs;
}

export function pairPlayers(players, round = 0, isOnline = false) {
  const alive = players.filter((p) => p.hp > 0);
  if (alive.length % 2 === 1) {
    const shuffled = [...alive].sort(() => Math.random() - 0.5);
    const pairs = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }
    pairs.push([shuffled[shuffled.length - 1], null]);
    return pairs;
  }

  if (isOnline && round > 0 && alive.length === players.length) {
    return roundRobinPairs(players, round);
  }

  const shuffled = [...alive].sort(() => Math.random() - 0.5);
  const pairs = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

function findMinion(player, uid) {
  const all = [...player.board.filter(Boolean), ...player.bench];
  return all.find((m) => m.uid === uid);
}

// ─── Resolve combat phase ──────────────────────────────────────

export function resolveCombatPhase(game) {
  game.phase = 'combat';
  game.battles = [];

  const pairs = pairPlayers(game.players, game.round, game.isOnline);

  for (const [p1, p2] of pairs) {
    if (!p2) {
      // Odd player out: no battle, no damage
      game.battles.push({
        player1: p1.name,
        player1Id: p1.id || p1.name,
        player2: '(ghost)',
        player2Id: null,
        result: { winner: 'attacker', survivors: getCombatBoard(p1), damageDealt: 0 },
        ghost: true,
      });
      continue;
    }

    const board1 = getCombatBoard(p1);
    const board2 = getCombatBoard(p2);

    const result = resolveBattle(board1, board2);

    // Grow and onKill buff changes from combat are permanent
    for (const ev of result.log) {
      if (ev.type === 'buff' && (ev.subtype === 'grow' || ev.subtype === 'onKill')) {
        const owner = ev.side === 'attacker' ? p1 : p2;
        const minion = findMinion(owner, ev.targetUid);
        if (minion) {
          minion.attack += ev.atk || 0;
          minion.health += ev.hp || 0;
          minion.maxHealth += ev.hp || 0;
        }
      } else if (ev.type === 'onKill' && (ev.atk || ev.hp)) {
        const owner = ev.side === 'attacker' ? p1 : p2;
        const minion = findMinion(owner, ev.sourceUid);
        if (minion) {
          minion.attack += ev.atk;
          minion.health += ev.hp;
          minion.maxHealth += ev.hp;
        }
      }
    }

    game.battles.push({
      player1: p1.name,
      player1Id: p1.id || p1.name,
      player2: p2.name,
      player2Id: p2.id || p2.name,
      result,
      ghost: false,
    });

    // Apply damage to the loser; damage = sum of surviving star + winner shop level
    let loser, winner;
    if (result.winner === 'attacker') {
      winner = p1;
      loser = p2;
    } else if (result.winner === 'defender') {
      winner = p2;
      loser = p1;
    } else {
      // Draw: both take 0 damage
      continue;
    }

    result.damageDealt += winner.level;
    loser.hp -= result.damageDealt;
    loser.streak = 0;
    winner.streak += 1;

    game.log.push(`Round ${game.round}: ${winner.name} beats ${loser.name} for ${result.damageDealt} damage`);
  }

  // Every surviving player gains 2 shop XP from the combat round
  for (const p of game.players) {
    if (p.hp > 0) p.xp += 2;
  }

  // Check for eliminations
  for (const p of game.players) {
    if (p.hp <= 0) {
      p.hp = 0;
      game.log.push(`${p.name} has been eliminated!`);
    }
  }

  // Check game over
  const alive = game.players.filter((p) => p.hp > 0);
  if (alive.length <= 1) {
    game.phase = 'gameover';
    game.winner = alive[0] || null;
    game.log.push(game.winner ? `${game.winner.name} wins!` : 'No winner!');
    return;
  }
}

export function advanceToNextRound(game) {
  game.round++;
  game.phase = 'shop';
  game.shopEndTime = Date.now() + PREP_TIME_MS;

  // Start next round for alive players
  for (const p of game.players) {
    if (p.hp > 0) {
      startRound(p, game.round);
      if (p.isAI) {
        aiShopPhase(p);
      }
    }
  }
}

// ─── Player actions during shop phase ──────────────────────────

export function playerReady(game, playerIndex) {
  const player = game.players[playerIndex];
  if (!player || player.isAI || player.hp <= 0) return false;
  player.ready = true;

  // Check if all alive players are ready
  const alive = game.players.filter((p) => p.hp > 0);
  const allReady = alive.every((p) => p.ready);

  if (allReady) {
    resolveCombatPhase(game);
  }

  return true;
}

// ─── Get game state for UI ──────────────────────────────────────

export function getStandings(game) {
  return game.players
    .map((p, i) => ({
      index: i,
      name: p.name,
      hp: p.hp,
      gold: p.gold,
      level: p.level,
      boardSize: p.board.filter(Boolean).length,
      isAI: p.isAI,
      alive: p.hp > 0,
    }))
    .sort((a, b) => b.hp - a.hp);
}
