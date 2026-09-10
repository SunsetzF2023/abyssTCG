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

import { createPlayer, startRound, autoMerge, getCombatBoard, buyXP, reroll, buyPiece, moveMinion, maxBoardSize } from './shop.js';
import { resolveBattle } from './battle.js';
import { setSeed } from './shop.js';

export const PLAYER_COUNT = 8;
export const MAX_ROUNDS = 30;

// ─── AI logic (simple greedy) ──────────────────────────────────

function aiShopPhase(player) {
  // Simple AI: buy pieces that fit board, level up if affordable, reroll sometimes
  autoMerge(player);

  // Try to buy pieces up to board size
  for (let i = player.shop.length - 1; i >= 0; i--) {
    const piece = player.shop[i];
    if (player.gold >= piece.tier) {
      const totalPieces = player.board.length + player.bench.length;
      if (totalPieces < maxBoardSize(player.level) + 2) {
        buyPiece(player, i);
        autoMerge(player);
      }
    }
  }

  // Move pieces from bench to board to fill board
  while (player.bench.length > 0 && player.board.length < maxBoardSize(player.level)) {
    // Move strongest bench piece to board
    player.bench.sort((a, b) => (b.attack + b.health) - (a.attack + a.health));
    const strongest = player.bench[0];
    if (strongest) {
      moveMinion(player, strongest.uid, true);
    } else {
      break;
    }
  }

  // Level up if possible and beneficial
  if (player.level < 6 && player.gold >= 8) {
    buyXP(player);
  }

  // Reroll if gold is plentiful
  if (player.gold >= 4 && player.board.length < maxBoardSize(player.level)) {
    reroll(player);
    // Buy again
    for (let i = player.shop.length - 1; i >= 0; i--) {
      const piece = player.shop[i];
      if (player.gold >= piece.tier) {
        buyPiece(player, i);
        autoMerge(player);
      }
    }
  }

  autoMerge(player);

  // Ensure board is full if possible
  while (player.bench.length > 0 && player.board.length < maxBoardSize(player.level)) {
    player.bench.sort((a, b) => (b.attack + b.health) - (a.attack + a.health));
    const strongest = player.bench[0];
    if (strongest) {
      moveMinion(player, strongest.uid, true);
    } else {
      break;
    }
  }

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
    startRound(p);
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
  };
}

// ─── Combat pairing ────────────────────────────────────────────

export function pairPlayers(players) {
  const alive = players.filter((p) => p.hp > 0);
  const shuffled = [...alive].sort(() => Math.random() - 0.5);
  const pairs = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  // Odd player out: fights a "ghost" (no damage taken, but no damage dealt)
  if (shuffled.length % 2 === 1) {
    pairs.push([shuffled[shuffled.length - 1], null]);
  }
  return pairs;
}

// ─── Resolve combat phase ──────────────────────────────────────

export function resolveCombatPhase(game) {
  game.phase = 'combat';
  game.battles = [];

  const pairs = pairPlayers(game.players);

  for (const [p1, p2] of pairs) {
    if (!p2) {
      // Odd player out: no battle, no damage
      game.battles.push({
        player1: p1.name,
        player2: '(ghost)',
        result: { winner: 'attacker', survivors: getCombatBoard(p1), damageDealt: 0 },
        ghost: true,
      });
      continue;
    }

    const board1 = getCombatBoard(p1);
    const board2 = getCombatBoard(p2);

    const result = resolveBattle(board1, board2);

    game.battles.push({
      player1: p1.name,
      player2: p2.name,
      result,
      ghost: false,
    });

    // Apply damage to the loser
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

    loser.hp -= result.damageDealt;
    loser.streak = 0;
    winner.streak += 1;

    game.log.push(`Round ${game.round}: ${winner.name} beats ${loser.name} for ${result.damageDealt} damage`);
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

  // Advance round
  game.round++;
  game.phase = 'shop';

  // Start next round for alive players
  for (const p of game.players) {
    if (p.hp > 0) {
      startRound(p);
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
      boardSize: p.board.length,
      isAI: p.isAI,
      alive: p.hp > 0,
    }))
    .sort((a, b) => b.hp - a.hp);
}
