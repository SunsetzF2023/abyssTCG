// ============================================================
// Shop & economy system — AbyssTCG autobattler mode
//
// Manages the shop phase between combat rounds:
//   - Gold income (base + interest + streak)
//   - Shop roll (weighted by tier)
//   - Buy / sell pieces
//   - Three-copy merge (3x star N -> 1x star N+1, max star 3)
//   - Player level (controls board size and shop tier odds)
//
// Pure logic, no DOM access. Fully testable.
// ============================================================

import { PIECES, getPiece } from './pieces.js';

export const BOARD_LIMIT = 6;     // max minions on the battle board (3 front + 3 back)
export const BENCH_LIMIT = 9;     // max minions on the bench (hand)
export const MAX_STAR = 3;        // 3x star-1 -> star-2, 3x star-2 -> star-3
export const STARTING_GOLD = 3;
export const MAX_GOLD = 10;       // interest caps at 5 (5 gold = 5*1 interest)
export const REROLL_COST = 1;
export const INTEREST_PER_GOLD = 1;
export const INTEREST_CAP = 5;    // max 5 gold interest
export const BASE_INCOME = 5;     // base income per round (after round 1)
export const STARTING_HP = 30;    // player hero HP

// Player level -> board size + shop tier odds.
// Board is always 6 slots (2 rows x 3 cols). Level mainly improves shop odds.
export const LEVEL_TABLE = [
  { level: 1, boardSize: 6, odds: { 1: 100, 2: 0,   3: 0,  4: 0,  5: 0,  6: 0  }, xpNeeded: 2 },
  { level: 2, boardSize: 6, odds: { 1: 70,  2: 30,  3: 0,  4: 0,  5: 0,  6: 0  }, xpNeeded: 2 },
  { level: 3, boardSize: 6, odds: { 1: 55,  2: 30,  3: 15, 4: 0,  5: 0,  6: 0  }, xpNeeded: 4 },
  { level: 4, boardSize: 6, odds: { 1: 40,  2: 30,  3: 20, 4: 10, 5: 0,  6: 0  }, xpNeeded: 6 },
  { level: 5, boardSize: 6, odds: { 1: 25,  2: 30,  3: 25, 4: 15, 5: 5,  6: 0  }, xpNeeded: 8 },
  { level: 6, boardSize: 6, odds: { 1: 15,  2: 25,  3: 30, 4: 20, 5: 8,  6: 2  }, xpNeeded: Infinity },
];

export const SHOP_SIZE = 4; // pieces shown per roll

// ─── RNG ──────────────────────────────────────────────────────
let _seed = 12345;
function rng() {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
export function setSeed(s) { _seed = s; }

function pickWeightedTier(odds) {
  const roll = rng() * 100;
  let acc = 0;
  for (const [tier, weight] of Object.entries(odds)) {
    acc += weight;
    if (roll < acc) return parseInt(tier, 10);
  }
  return 1;
}

function randomPieceFromTier(tier) {
  const pool = PIECES.filter((p) => p.tier === tier && !p.isToken);
  return pool[Math.floor(rng() * pool.length)];
}

// ─── Player state ─────────────────────────────────────────────

export function createPlayer(name = 'Player', isAI = false) {
  return {
    name,
    isAI,
    hp: STARTING_HP,
    gold: STARTING_GOLD,
    level: 1,
    xp: 0,
    board: [null, null, null, null, null, null], // 6 slots: 0-2 front, 3-5 back
    bench: [],      // array of minion instances (waiting area)
    shop: [],       // array of piece definitions currently offered
    streak: 0,      // win/loss streak counter
    lockedShop: false,
    ready: false,   // ready for combat
  };
}

export function getLevelInfo(level) {
  return LEVEL_TABLE[Math.min(level - 1, LEVEL_TABLE.length - 1)];
}

export function maxBoardSize(level) {
  return getLevelInfo(level).boardSize;
}

// ─── Income ────────────────────────────────────────────────────

export function calculateIncome(player) {
  const base = BASE_INCOME;
  const interest = Math.min(Math.floor(player.gold / INTEREST_PER_GOLD), INTEREST_CAP);
  const streakBonus = Math.min(Math.floor(player.streak / 2), 3);
  return { base, interest, streakBonus, total: base + interest + streakBonus };
}

// ─── Shop operations ───────────────────────────────────────────

export function rollShop(player) {
  const odds = getLevelInfo(player.level).odds;
  player.shop = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    const tier = pickWeightedTier(odds);
    const piece = randomPieceFromTier(tier);
    if (piece) player.shop.push({ ...piece });
  }
  return player.shop;
}

export function reroll(player) {
  if (player.gold < REROLL_COST) return false;
  player.gold -= REROLL_COST;
  rollShop(player);
  return true;
}

export function buyPiece(player, shopIndex) {
  const piece = player.shop[shopIndex];
  if (!piece) return false;
  if (player.gold < piece.tier) return false;
  if (player.bench.length >= BENCH_LIMIT && player.board.filter(Boolean).length >= BOARD_LIMIT) return false;
  player.gold -= piece.tier;
  player.shop.splice(shopIndex, 1);
  // Add to bench as a star-1 instance
  player.bench.push(createMinionInstance(piece.id, 1));
  return true;
}

export function sellPiece(player, minionUid) {
  const benchIdx = player.bench.findIndex((m) => m.uid === minionUid);
  if (benchIdx !== -1) {
    const minion = player.bench[benchIdx];
    player.bench.splice(benchIdx, 1);
    player.gold += minion.tier;
    return true;
  }
  const boardIdx = player.board.findIndex((m) => m && m.uid === minionUid);
  if (boardIdx !== -1) {
    const minion = player.board[boardIdx];
    player.board[boardIdx] = null;
    player.gold += minion.tier;
    return true;
  }
  return false;
}

// ─── Board management ─────────────────────────────────────────
// Board is a fixed 6-slot array: [0,1,2] front row, [3,4,5] back row.
// `null` means an empty slot.

export function placeMinion(player, minionUid, targetPos) {
  if (targetPos < 0 || targetPos >= BOARD_LIMIT) return false;
  const benchIdx = player.bench.findIndex((m) => m && m.uid === minionUid);
  const boardIdx = player.board.findIndex((m) => m && m.uid === minionUid);

  if (benchIdx !== -1) {
    const existing = player.board[targetPos];
    const [minion] = player.bench.splice(benchIdx, 1);
    if (existing) player.bench.push(existing);
    player.board[targetPos] = minion;
    applyBattlecry(player, minion, targetPos);
    return true;
  }

  if (boardIdx !== -1) {
    const existing = player.board[targetPos];
    const minion = player.board[boardIdx];
    player.board[targetPos] = minion;
    player.board[boardIdx] = existing;
    return true;
  }

  return false;
}

function applyBattlecry(player, minion, pos) {
  if (!minion.ability || minion.ability.type !== 'battlecry' || minion.battlecryTriggered) return;
  minion.battlecryTriggered = true;
  const ab = minion.ability;
  const board = player.board;
  const others = board.filter((m) => m && m.uid !== minion.uid);

  function buff(m) {
    m.attack += ab.atk || 0;
    m.health += ab.hp || 0;
    m.maxHealth += ab.hp || 0;
  }

  function adjacentPositions(p) {
    const adj = [];
    const col = p % 3;
    if (col > 0) adj.push(p - 1);
    if (col < 2) adj.push(p + 1);
    if (p < 3) adj.push(p + 3);
    if (p >= 3) adj.push(p - 3);
    return adj;
  }

  switch (ab.subtype) {
    case 'buffRandomAlly': {
      if (others.length === 0) return;
      const target = others[Math.floor(Math.random() * others.length)];
      buff(target);
      break;
    }
    case 'buffAdjacentAllies': {
      adjacentPositions(pos).forEach((i) => {
        const m = board[i];
        if (m && m.uid !== minion.uid) buff(m);
      });
      break;
    }
    case 'buffAlliesIfThree': {
      if (others.length + 1 >= 3) board.forEach((m) => { if (m && m.uid !== minion.uid) buff(m); });
      break;
    }
  }
}

export function moveToBench(player, boardPos) {
  if (boardPos < 0 || boardPos >= BOARD_LIMIT) return false;
  const minion = player.board[boardPos];
  if (!minion) return false;
  if (player.bench.length >= BENCH_LIMIT) return false;
  player.board[boardPos] = null;
  player.bench.push(minion);
  return true;
}

export function swapBoardSlots(player, posA, posB) {
  if (posA < 0 || posA >= BOARD_LIMIT || posB < 0 || posB >= BOARD_LIMIT) return false;
  [player.board[posA], player.board[posB]] = [player.board[posB], player.board[posA]];
  return true;
}

export function getEmptyBoardSlot(player) {
  return player.board.findIndex((m) => m === null);
}

// ─── Three-copy merge ──────────────────────────────────────────
// 3 copies of the same piece at star N merge into 1 at star N+1.
// Searches both board and bench for copies.

let _minionSeq = 0;
function createMinionInstance(pieceId, star) {
  const piece = getPiece(pieceId);
  if (!piece) throw new Error('Unknown piece: ' + pieceId);
  const mult = star;
  return {
    uid: 'p' + (++_minionSeq),
    pieceId: piece.id,
    name: piece.name,
    race: piece.race,
    tier: piece.tier,
    star,
    attack: piece.attack * mult,
    health: piece.health * mult,
    maxHealth: piece.health * mult,
    ability: piece.ability ? { ...piece.ability } : null,
    description: piece.description || '',
    flavor: piece.flavor || '',
    shield: piece.ability && piece.ability.type === 'shield',
    hasEnrage: piece.ability && piece.ability.type === 'enrage',
    battlecryTriggered: false,
    enrageActive: false,
    isToken: !!piece.isToken,
    attacksLeft: piece.ability && piece.ability.type === 'frenzy' ? piece.ability.count : 1,
  };
}

export function tryMerge(player, pieceId, star) {
  // Find all copies of this piece at the given star level
  const all = [...player.board.filter(Boolean), ...player.bench];
  const copies = all.filter((m) => m.pieceId === pieceId && m.star === star);
  if (copies.length < 3) return null;

  // Remove 3 copies (prefer bench first)
  let removed = 0;
  const toRemove = new Set();
  // Prefer bench copies
  for (const m of player.bench) {
    if (removed >= 3) break;
    if (m.pieceId === pieceId && m.star === star && !toRemove.has(m.uid)) {
      toRemove.add(m.uid);
      removed++;
    }
  }
  // Then board copies
  for (const m of player.board) {
    if (removed >= 3) break;
    if (m && m.pieceId === pieceId && m.star === star && !toRemove.has(m.uid)) {
      toRemove.add(m.uid);
      removed++;
    }
  }

  if (removed < 3) return null;

  player.bench = player.bench.filter((m) => !toRemove.has(m.uid));
  for (let i = 0; i < player.board.length; i++) {
    if (player.board[i] && toRemove.has(player.board[i].uid)) {
      player.board[i] = null;
    }
  }

  // Create the upgraded minion
  const newStar = Math.min(star + 1, MAX_STAR);
  const upgraded = createMinionInstance(pieceId, newStar);

  // Place on bench (or board if bench is full and board has space)
  if (player.bench.length < BENCH_LIMIT) {
    player.bench.push(upgraded);
  } else {
    const emptySlot = getEmptyBoardSlot(player);
    if (emptySlot !== -1) {
      player.board[emptySlot] = upgraded;
    } else {
      player.bench.push(upgraded); // force onto bench even if over limit temporarily
    }
  }

  return upgraded;
}

/** Auto-merges all possible 3-copy combinations for a player. */
export function autoMerge(player) {
  const merged = [];
  let changed = true;
  while (changed) {
    changed = false;
    const all = [...player.board.filter(Boolean), ...player.bench];
    const counts = {};
    for (const m of all) {
      const key = m.pieceId + ':' + m.star;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      if (count >= 3) {
        const [pieceId, starStr] = key.split(':');
        const star = parseInt(starStr, 10);
        if (star < MAX_STAR) {
          const result = tryMerge(player, pieceId, star);
          if (result) {
            merged.push(result);
            changed = true;
            break;
          }
        }
      }
    }
  }
  return merged;
}

// ─── Level up ──────────────────────────────────────────────────

export function buyXP(player) {
  const cost = 4; // 4 gold for 4 XP (standard autobattler rate)
  if (player.gold < cost) return false;
  const levelInfo = getLevelInfo(player.level);
  if (levelInfo.xpNeeded === Infinity) return false; // max level
  player.gold -= cost;
  player.xp += 4;
  while (player.xp >= getLevelInfo(player.level).xpNeeded && player.level < LEVEL_TABLE.length) {
    player.xp -= getLevelInfo(player.level).xpNeeded;
    player.level++;
  }
  return true;
}

// ─── Round setup ───────────────────────────────────────────────

export function startRound(player) {
  const income = calculateIncome(player);
  player.gold = Math.min(player.gold + income.total, MAX_GOLD + 5); // allow slight overflow
  if (!player.lockedShop) {
    rollShop(player);
  }
  player.ready = false;
}

export function getCombatBoard(player) {
  return player.board.map((m) => m ? { ...m } : null);
}
