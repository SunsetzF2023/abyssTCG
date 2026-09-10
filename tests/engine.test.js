import { describe, it, expect } from 'vitest';
import { FACTIONS } from '../src/factions.js';
import { getCard, cardsForFaction, CARDS } from '../src/cards.js';
import {
  newGame,
  playCard,
  attack,
  endTurn,
  requiresMinionTarget,
} from '../src/engine.js';

function pickTwoFactionIds() {
  const ids = FACTIONS.map((f) => f.id);
  const p = ids[Math.floor(Math.random() * ids.length)];
  const others = ids.filter((x) => x !== p);
  const a = others[Math.floor(Math.random() * others.length)];
  return [p, a];
}

/** Plays every affordable card it can, attacks with everything ready,
 * then ends the turn. Used to drive full games without touching the DOM. */
function playOutPlayerTurn(game) {
  let played = true;
  while (played && !game.over) {
    played = false;
    for (let idx = 0; idx < game.player.hand.length; idx++) {
      const card = getCard(game.player.hand[idx].cardId);
      if (game.player.manaCur < card.cost) continue;
      let targetUid = null;
      if (requiresMinionTarget(card)) {
        const pool = game.ai.board.length > 0 ? game.ai.board : game.player.board;
        if (pool.length === 0) continue;
        targetUid = pool[0].uid;
      }
      const err = playCard(game, 'player', idx, targetUid);
      if (!err) { played = true; break; }
    }
  }
  game.player.board
    .filter((m) => m.canAttack)
    .forEach((m) => { if (!game.over) attack(game, 'player', m.uid, 'hero'); });
  if (!game.over) endTurn(game);
}

describe('card database', () => {
  it('every card is a minion with attack/health stats', () => {
    CARDS.forEach((card) => {
      expect(card.type).toBe('minion');
      expect(typeof card.attack).toBe('number');
      expect(typeof card.health).toBe('number');
    });
  });

  it('every faction has at least one card', () => {
    FACTIONS.forEach((f) => {
      expect(cardsForFaction(f.id).length).toBeGreaterThan(0);
    });
  });
});

describe('requiresMinionTarget', () => {
  it('returns false for vanilla minions without an effect', () => {
    const vanilla = getCard('h_recruit');
    expect(requiresMinionTarget(vanilla)).toBe(false);
  });

  it('returns true for a battlecry that damages a minion', () => {
    const battlecry = getCard('h_strike');
    expect(requiresMinionTarget(battlecry)).toBe(true);
  });
});

describe('newGame', () => {
  it('deals starting hands and puts the player on turn 1', () => {
    const game = newGame('human', 'orc');
    expect(game.player.hand.length).toBe(4); // 3 opening draws + 1 from startTurn
    expect(game.ai.hand.length).toBe(4);
    expect(game.active).toBe('player');
    expect(game.turnCount).toBe(1);
  });
});

describe('full game simulation', () => {
  it('always reaches a winner without crashing or getting stuck', () => {
    for (let g = 0; g < 30; g++) {
      const [p, a] = pickTwoFactionIds();
      const game = newGame(p, a);
      let safety = 0;
      while (!game.over && safety < 500) {
        playOutPlayerTurn(game);
        safety++;
      }
      expect(safety).toBeLessThan(500); // would only trip on a stuck/infinite turn
      expect(game.over).toBe(true);
      expect(['player', 'ai', 'draw']).toContain(game.winner);
    }
  });
});
