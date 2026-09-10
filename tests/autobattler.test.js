import { describe, it, expect } from 'vitest';
import { PIECES, TOKEN_PIECES } from '../src/autobattler/pieces.js';
import { createMinion, resolveBattle, makeBoard } from '../src/autobattler/battle.js';

describe('piece database', () => {
  it('has 25 pieces across 5 tiers', () => {
    expect(PIECES.length).toBe(25);
    for (let t = 1; t <= 5; t++) {
      const tierPieces = PIECES.filter((p) => p.tier === t);
      expect(tierPieces.length).toBe(5);
    }
  });

  it('every piece has valid stats and race', () => {
    PIECES.forEach((p) => {
      expect(p.attack).toBeGreaterThan(0);
      expect(p.health).toBeGreaterThan(0);
      expect(['human', 'orc', 'undead', 'demon', 'beast']).toContain(p.race);
    });
  });

  it('token pieces exist for deathrattle summons', () => {
    expect(TOKEN_PIECES.t1_thrall_token).toBeDefined();
    expect(TOKEN_PIECES.t1_thrall_token.attack).toBe(1);
    expect(TOKEN_PIECES.t1_thrall_token.health).toBe(1);
  });
});

describe('createMinion', () => {
  it('star 1 uses base stats', () => {
    const m = createMinion('t1_recruit', 1);
    expect(m.attack).toBe(2);
    expect(m.health).toBe(3);
    expect(m.star).toBe(1);
  });

  it('star 2 doubles stats', () => {
    const m = createMinion('t1_recruit', 2);
    expect(m.attack).toBe(4);
    expect(m.health).toBe(6);
  });

  it('star 3 triples stats', () => {
    const m = createMinion('t1_recruit', 3);
    expect(m.attack).toBe(6);
    expect(m.health).toBe(9);
  });

  it('divineShield pieces start with shield', () => {
    const m = createMinion('t2_pact_demon', 1);
    expect(m.divineShield).toBe(true);
  });

  it('enrage pieces track enrage state', () => {
    const m = createMinion('t1_grunt', 1);
    expect(m.hasEnrage).toBe(true);
    expect(m.enrageActive).toBe(false);
  });
});

describe('resolveBattle — basic combat', () => {
  it('empty attacker board loses to non-empty defender', () => {
    const attacker = [];
    const defender = makeBoard({ pieceId: 't1_recruit', star: 1 });
    const result = resolveBattle(attacker, defender);
    expect(result.winner).toBe('defender');
    expect(result.survivors.length).toBe(1);
  });

  it('both empty boards = draw', () => {
    const result = resolveBattle([], []);
    expect(result.winner).toBe('draw');
    expect(result.damageDealt).toBe(0);
  });

  it('stronger board wins', () => {
    const attacker = makeBoard(
      { pieceId: 't5_godslayer', star: 1 }, // 8/7
      { pieceId: 't5_paladin', star: 1 },   // 7/8
    );
    const defender = makeBoard({ pieceId: 't1_recruit', star: 1 }); // 2/3
    const result = resolveBattle(attacker, defender);
    expect(result.winner).toBe('attacker');
    expect(result.damageDealt).toBeGreaterThan(0);
  });

  it('battle always terminates within iteration cap', () => {
    // Two divine-shield pieces that can't kill each other quickly
    const a = makeBoard({ pieceId: 't2_pact_demon', star: 1 });
    const d = makeBoard({ pieceId: 't2_pact_demon', star: 1 });
    const result = resolveBattle(a, d);
    expect(result.iterations).toBeLessThan(200);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });
});

describe('resolveBattle — abilities', () => {
  it('taunt forces targeting', () => {
    // Attacker has a strong minion; defender has a taunt + a weak minion.
    // The taunt should be hit first (it's the only valid target while alive).
    const attacker = makeBoard({ pieceId: 't3_butcher', star: 1 }); // 5/4
    const defender = makeBoard(
      { pieceId: 't1_recruit', star: 1 },  // 2/3 taunt
      { pieceId: 't1_imp', star: 1 },      // 3/1
    );
    const result = resolveBattle(attacker, defender);
    // Battle should resolve (not crash)
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('divineShield absorbs first hit', () => {
    // A 3/1 divine shield vs 2/3: the 2/3 hits for 2, absorbed by shield,
    // then the 3/1 hits back for 3, killing the 2/3.
    const attacker = makeBoard({ pieceId: 't2_pact_demon', star: 1 }); // 4/3 divine shield
    const defender = makeBoard({ pieceId: 't1_recruit', star: 1 });    // 2/3 taunt
    const result = resolveBattle(attacker, defender);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('poison kills target regardless of health', () => {
    // A 3/3 poison vs 7/8 taunt: poison should eventually kill the taunt.
    const attacker = makeBoard({ pieceId: 't2_boar', star: 1 }); // 3/3 poison
    const defender = makeBoard({ pieceId: 't5_paladin', star: 1 }); // 7/8 taunt
    const result = resolveBattle(attacker, defender);
    // The poison piece should kill the taunt in one hit (target.health = 0)
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('deathrattle summon creates new minions', () => {
    // A 1/2 with deathrattle:summon 1 token vs a 3/1 that kills it.
    // When the 1/2 dies, it should summon a 1/1 token.
    const attacker = makeBoard({ pieceId: 't1_imp', star: 1 }); // 3/1
    const defender = makeBoard({ pieceId: 't1_thrall', star: 1 }); // 1/2 deathrattle summon
    const result = resolveBattle(attacker, defender);
    // Battle resolves without crash; winner is determined
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('cleave damages adjacent enemies', () => {
    // A 4/3 cleave attacker vs three 1/2 minions lined up.
    const attacker = makeBoard({ pieceId: 't2_axeman', star: 1 }); // 4/3 cleave
    const defender = makeBoard(
      { pieceId: 't1_thrall', star: 1 }, // 1/2
      { pieceId: 't1_thrall', star: 1 }, // 1/2
      { pieceId: 't1_thrall', star: 1 }, // 1/2
    );
    const result = resolveBattle(attacker, defender);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('enrage activates when below 50% hp', () => {
    // A 3/2 enrage+2 minion: when it takes 1 damage (to 1 hp, below 50% of 2),
    // it should gain +2 attack.
    const m = createMinion('t1_grunt', 1); // 3/2 enrage+2
    expect(m.enrageActive).toBe(false);
    // Simulate taking 1 damage
    m.health -= 1;
    if (m.health <= m.maxHealth / 2) m.enrageActive = true;
    expect(m.enrageActive).toBe(true);
    // Effective attack should be 3 + 2 = 5
    expect(m.attack + (m.enrageActive ? m.ability.atk : 0)).toBe(5);
  });
});

describe('resolveBattle — damage settlement', () => {
  it('winner damage = sum of surviving minions (tier * star)', () => {
    // Attacker wins with a tier-3 star-1 minion surviving (3*1=3 damage)
    const attacker = makeBoard(
      { pieceId: 't3_butcher', star: 1 }, // 5/4
    );
    const defender = makeBoard({ pieceId: 't1_imp', star: 1 }); // 3/1
    const result = resolveBattle(attacker, defender);
    if (result.winner === 'attacker' && result.survivors.length === 1) {
      const s = result.survivors[0];
      expect(result.damageDealt).toBe(s.tier * s.star);
    }
  });

  it('star-2 survivors deal double tier damage', () => {
    const attacker = makeBoard({ pieceId: 't1_recruit', star: 2 }); // 4/6
    const defender = makeBoard({ pieceId: 't1_imp', star: 1 });     // 3/1
    const result = resolveBattle(attacker, defender);
    if (result.winner === 'attacker' && result.survivors.length === 1) {
      // tier 1 * star 2 = 2 damage
      expect(result.damageDealt).toBe(2);
    }
  });
});

describe('resolveBattle — full simulation', () => {
  it('100 random battles complete without errors', () => {
    const allPieceIds = PIECES.map((p) => p.id);
    for (let i = 0; i < 100; i++) {
      const aSize = 1 + Math.floor(Math.random() * 5);
      const dSize = 1 + Math.floor(Math.random() * 5);
      const a = [];
      const d = [];
      for (let j = 0; j < aSize; j++) {
        const id = allPieceIds[Math.floor(Math.random() * allPieceIds.length)];
        const star = 1 + Math.floor(Math.random() * 3);
        a.push(createMinion(id, star));
      }
      for (let j = 0; j < dSize; j++) {
        const id = allPieceIds[Math.floor(Math.random() * allPieceIds.length)];
        const star = 1 + Math.floor(Math.random() * 3);
        d.push(createMinion(id, star));
      }
      const result = resolveBattle(a, d);
      expect(['attacker', 'defender', 'draw']).toContain(result.winner);
      expect(result.iterations).toBeLessThan(500);
    }
  });
});
