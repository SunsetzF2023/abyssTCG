import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlayer, rollShop, reroll, buyPiece, moveMinion,
  tryMerge, autoMerge, buyXP, calculateIncome,
  maxBoardSize, BENCH_LIMIT, STARTING_HP, setSeed,
} from '../src/autobattler/shop.js';
import { PIECES } from '../src/autobattler/pieces.js';
// PIECES used in merge tests below
import { createGame, resolveCombatPhase, pairPlayers, getStandings, PLAYER_COUNT } from '../src/autobattler/game.js';

beforeEach(() => {
  setSeed(42);
});

describe('shop — player creation', () => {
  it('creates a player with correct starting stats', () => {
    const p = createPlayer('Test', false);
    expect(p.hp).toBe(STARTING_HP);
    expect(p.gold).toBe(3);
    expect(p.level).toBe(1);
    expect(p.board).toHaveLength(0);
    expect(p.bench).toHaveLength(0);
  });
});

describe('shop — income', () => {
  it('base income is 5 with no interest or streak', () => {
    const p = createPlayer('Test');
    p.gold = 0;
    p.streak = 0;
    const income = calculateIncome(p);
    expect(income.base).toBe(5);
    expect(income.interest).toBe(0);
    expect(income.streakBonus).toBe(0);
    expect(income.total).toBe(5);
  });

  it('interest is 1 per gold up to 5', () => {
    const p = createPlayer('Test');
    p.gold = 5;
    const income = calculateIncome(p);
    expect(income.interest).toBe(5);
  });

  it('interest caps at 5', () => {
    const p = createPlayer('Test');
    p.gold = 20;
    const income = calculateIncome(p);
    expect(income.interest).toBe(5);
  });

  it('streak gives bonus after 2 wins', () => {
    const p = createPlayer('Test');
    p.streak = 4;
    const income = calculateIncome(p);
    expect(income.streakBonus).toBe(2);
  });
});

describe('shop — rolling and buying', () => {
  it('rollShop produces 4 pieces', () => {
    const p = createPlayer('Test');
    rollShop(p);
    expect(p.shop).toHaveLength(4);
    p.shop.forEach((piece) => {
      expect(piece.id).toBeDefined();
      expect(piece.tier).toBeGreaterThanOrEqual(1);
    });
  });

  it('buying a piece costs gold and adds to bench', () => {
    const p = createPlayer('Test');
    p.gold = 10;
    rollShop(p);
    const piece = p.shop[0];
    const cost = piece.tier;
    const result = buyPiece(p, 0);
    expect(result).toBe(true);
    expect(p.gold).toBe(10 - cost);
    expect(p.bench).toHaveLength(1);
    expect(p.bench[0].pieceId).toBe(piece.id);
    expect(p.bench[0].star).toBe(1);
  });

  it('cannot buy without enough gold', () => {
    const p = createPlayer('Test');
    p.gold = 0;
    rollShop(p);
    const result = buyPiece(p, 0);
    expect(result).toBe(false);
  });

  it('reroll costs 1 gold and refreshes shop', () => {
    const p = createPlayer('Test');
    p.gold = 5;
    rollShop(p);
    const result = reroll(p);
    expect(result).toBe(true);
    expect(p.gold).toBe(4);
    // New shop should (very likely) be different
    expect(p.shop).toHaveLength(4);
  });
});

describe('shop — board management', () => {
  it('moveMinion transfers between bench and board', () => {
    const p = createPlayer('Test');
    p.gold = 10;
    rollShop(p);
    buyPiece(p, 0);
    const uid = p.bench[0].uid;
    expect(moveMinion(p, uid, true)).toBe(true);
    expect(p.bench).toHaveLength(0);
    expect(p.board).toHaveLength(1);
  });

  it('cannot exceed board size limit', () => {
    const p = createPlayer('Test');
    p.level = 1; // board size 3
    p.gold = 20;
    // Fill bench with 4 pieces
    for (let r = 0; r < 4; r++) {
      rollShop(p);
      for (let i = 0; i < p.shop.length; i++) {
        if (p.gold >= p.shop[i].tier && p.bench.length < BENCH_LIMIT) {
          buyPiece(p, i);
        }
      }
    }
    // Move 3 to board (limit)
    for (let i = 0; i < 3; i++) {
      if (p.bench[0]) moveMinion(p, p.bench[0].uid, true);
    }
    expect(p.board).toHaveLength(3);
    // 4th should fail
    if (p.bench[0]) {
      expect(moveMinion(p, p.bench[0].uid, true)).toBe(false);
    }
  });
});

describe('shop — three-copy merge', () => {
  it('merges 3 same pieces into star 2', () => {
    const p = createPlayer('Test');
    // Manually add 3 copies of the same piece
    const piece = PIECES[0];
    for (let i = 0; i < 3; i++) {
      p.bench.push({
        uid: 'test' + i,
        pieceId: piece.id,
        name: piece.name,
        race: piece.race,
        tier: piece.tier,
        star: 1,
        attack: piece.attack,
        health: piece.health,
        maxHealth: piece.health,
        ability: piece.ability,
      });
    }
    const result = tryMerge(p, piece.id, 1);
    expect(result).toBeTruthy();
    expect(result.star).toBe(2);
    expect(result.attack).toBe(piece.attack * 2);
    expect(result.health).toBe(piece.health * 2);
    // Should have removed 3 and added 1
    expect(p.bench.length + p.board.length).toBe(1);
  });

  it('autoMerge finds and merges all triples', () => {
    const p = createPlayer('Test');
    const piece = PIECES[0];
    // Add 3 copies of piece A and 3 of piece B
    for (let i = 0; i < 3; i++) {
      p.bench.push({
        uid: 'a' + i, pieceId: piece.id, name: piece.name, race: piece.race,
        tier: piece.tier, star: 1, attack: piece.attack, health: piece.health,
        maxHealth: piece.health, ability: piece.ability,
      });
    }
    const piece2 = PIECES[1];
    for (let i = 0; i < 3; i++) {
      p.bench.push({
        uid: 'b' + i, pieceId: piece2.id, name: piece2.name, race: piece2.race,
        tier: piece2.tier, star: 1, attack: piece2.attack, health: piece2.health,
        maxHealth: piece2.health, ability: piece2.ability,
      });
    }
    const merged = autoMerge(p);
    expect(merged).toHaveLength(2);
    expect(merged[0].star).toBe(2);
    expect(merged[1].star).toBe(2);
  });
});

describe('shop — leveling', () => {
  it('buyXP costs 4 gold and adds XP (may level up)', () => {
    const p = createPlayer('Test');
    p.gold = 10;
    const result = buyXP(p);
    expect(result).toBe(true);
    expect(p.gold).toBe(6);
    // Level 1 needs 2 XP, level 2 needs 2 XP; 4 XP -> two level-ups to level 3
    expect(p.level).toBe(3);
    expect(p.xp).toBe(0);
  });

  it('leveling up increases board size', () => {
    const p = createPlayer('Test');
    expect(maxBoardSize(p.level)).toBe(3);
    p.gold = 20;
    // Buy enough XP to level up
    while (p.level < 3) {
      buyXP(p);
    }
    expect(p.level).toBe(3);
    expect(maxBoardSize(p.level)).toBe(5);
  });
});

describe('game flow', () => {
  it('creates a game with 8 players', () => {
    const game = createGame('Tester');
    expect(game.players).toHaveLength(PLAYER_COUNT);
    expect(game.round).toBe(1);
    expect(game.phase).toBe('shop');
    // 1 human + 7 AI
    expect(game.players.filter((p) => !p.isAI)).toHaveLength(1);
    expect(game.players.filter((p) => p.isAI)).toHaveLength(7);
  });

  it('all AI players have boards after creation', () => {
    const game = createGame('Tester');
    game.players.filter((p) => p.isAI).forEach((p) => {
      expect(p.ready).toBe(true);
      // AI should have bought something (board or bench not empty)
      expect(p.board.length + p.bench.length).toBeGreaterThan(0);
    });
  });

  it('pairPlayers creates valid pairs', () => {
    const game = createGame('Tester');
    const pairs = pairPlayers(game.players);
    expect(pairs.length).toBeGreaterThanOrEqual(4); // 8 players = 4 pairs
    pairs.forEach(([a]) => {
      expect(a).toBeTruthy();
      // b can be null for odd player out
    });
  });

  it('resolveCombatPhase runs a full combat round', () => {
    const game = createGame('Tester');
    // Mark human player as ready
    game.players[0].ready = true;
    resolveCombatPhase(game);
    expect(game.round).toBe(2);
    expect(game.battles.length).toBeGreaterThan(0);
    expect(game.phase).toBe('shop');
  });

  it('game progresses and eventually ends or reaches max rounds', () => {
    const game = createGame('Tester');
    let rounds = 0;
    while (game.phase !== 'gameover' && rounds < MAX_ROUNDS_SAFE) {
      game.players[0].ready = true;
      resolveCombatPhase(game);
      rounds++;
    }
    expect(['shop', 'gameover']).toContain(game.phase);
  });
});

const MAX_ROUNDS_SAFE = 30;

describe('game — standings', () => {
  it('getStandings returns sorted players', () => {
    const game = createGame('Tester');
    const standings = getStandings(game);
    expect(standings).toHaveLength(PLAYER_COUNT);
    // Should be sorted by HP descending
    for (let i = 0; i < standings.length - 1; i++) {
      expect(standings[i].hp).toBeGreaterThanOrEqual(standings[i + 1].hp);
    }
  });
});
