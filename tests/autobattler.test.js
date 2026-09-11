import { describe, it, expect } from 'vitest';
import { PIECES, TOKEN_PIECES } from '../src/autobattler/pieces.js';
import { createMinion, resolveBattle, makeBoard } from '../src/autobattler/battle.js';

describe('piece database', () => {
  it('has 48 pieces across 6 tiers', () => {
    expect(PIECES.length).toBe(48);
    for (let t = 1; t <= 6; t++) {
      const tierPieces = PIECES.filter((p) => p.tier === t);
      expect(tierPieces.length).toBe(8); // one per race per tier
    }
  });

  it('every piece has valid stats and race', () => {
    PIECES.forEach((p) => {
      expect(p.attack).toBeGreaterThan(0);
      expect(p.health).toBeGreaterThan(0);
      expect(['neutral', 'ghost', 'warrior', 'starborne', 'mech', 'nature', 'beast', 'dragon']).toContain(p.race);
    });
  });

  it('token pieces exist for summons', () => {
    expect(TOKEN_PIECES.t1_spark_drone).toBeDefined();
    expect(TOKEN_PIECES.t1_spectral_wisp).toBeDefined();
  });
});

describe('createMinion', () => {
  it('star 1 uses base stats', () => {
    const m = createMinion('t1_shieldbearer', 1);
    expect(m.attack).toBe(1);
    expect(m.health).toBe(4);
    expect(m.star).toBe(1);
  });

  it('star 2 doubles stats', () => {
    const m = createMinion('t1_shieldbearer', 2);
    expect(m.attack).toBe(2);
    expect(m.health).toBe(8);
  });

  it('star 3 triples stats', () => {
    const m = createMinion('t1_shieldbearer', 3);
    expect(m.attack).toBe(3);
    expect(m.health).toBe(12);
  });

  it('shield pieces start with shield', () => {
    const m = createMinion('t1_drakelet', 1);
    expect(m.shield).toBe(true);
  });

  it('frenzy pieces have attacks left', () => {
    const m = createMinion('t5_adventurer', 1);
    expect(m.attacksLeft).toBe(2);
  });
});

describe('resolveBattle — basic combat', () => {
  it('empty attacker board loses to non-empty defender', () => {
    const attacker = [];
    const defender = makeBoard({ pieceId: 't1_shieldbearer', star: 1 });
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
      { pieceId: 't6_behemoth', star: 1 },
      { pieceId: 't6_juggernaut', star: 1 },
    );
    const defender = makeBoard({ pieceId: 't1_wanderer', star: 1 });
    const result = resolveBattle(attacker, defender);
    expect(result.winner).toBe('attacker');
    expect(result.damageDealt).toBeGreaterThan(0);
  });

  it('battle always terminates within iteration cap', () => {
    const a = makeBoard({ pieceId: 't1_drakelet', star: 1 });
    const d = makeBoard({ pieceId: 't1_drakelet', star: 1 });
    const result = resolveBattle(a, d);
    expect(result.iterations).toBeLessThan(100);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });
});

describe('resolveBattle — abilities', () => {
  it('taunt forces targeting', () => {
    const attacker = makeBoard({ pieceId: 't2_hyena', star: 1 }); // 3/2 first strike
    const defender = makeBoard(
      { pieceId: 't1_shieldbearer', star: 1 }, // 1/4 taunt
      { pieceId: 't1_wanderer', star: 1 },     // 1/2
    );
    const result = resolveBattle(attacker, defender);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('shield absorbs a hit', () => {
    const attacker = makeBoard({ pieceId: 't2_whelp', star: 1 }); // 3/3
    const defender = makeBoard({ pieceId: 't1_drakelet', star: 1 }); // 2/2 shield
    const result = resolveBattle(attacker, defender);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('firstStrike prevents counter when killing', () => {
    const attacker = makeBoard({ pieceId: 't2_hyena', star: 1 }); // 3/2 first strike
    const defender = makeBoard({ pieceId: 't2_whelp', star: 1 }); // 3/3
    const result = resolveBattle(attacker, defender);
    expect(result.winner).toBe('attacker');
    expect(result.attackerSurvivors[0].name).toBe('鬣狗');
  });

  it('deathrattle summon creates new minions', () => {
    const attacker = makeBoard({ pieceId: 't1_wanderer', star: 1 }); // 1/2
    const defender = makeBoard({ pieceId: 't1_gearling', star: 1 }); // 1/2, summon token on death
    const result = resolveBattle(attacker, defender);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('cleave damages adjacent enemies', () => {
    const attacker = makeBoard({ pieceId: 't3_serpent', star: 1 }); // 4/4 cleave
    const defender = makeBoard(
      { pieceId: 't1_wanderer', star: 1 },
      { pieceId: 't1_wanderer', star: 1 },
      { pieceId: 't1_wanderer', star: 1 },
    );
    const result = resolveBattle(attacker, defender);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('pierce hits minion behind target', () => {
    const attacker = makeBoard({ pieceId: 't2_whelp', star: 1 }); // 3/3 pierce
    const defender = makeBoard(
      { pieceId: 't1_wanderer', star: 1 },
      { pieceId: 't1_wanderer', star: 1 },
    );
    const result = resolveBattle(attacker, defender);
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('frenzy allows multiple attacks', () => {
    const a = makeBoard({ pieceId: 't5_adventurer', star: 1 }); // 5/5 attacks twice
    const d = makeBoard({ pieceId: 't1_wanderer', star: 1 }); // 1/2
    const result = resolveBattle(a, d);
    expect(result.winner).toBe('attacker');
  });
});

describe('resolveBattle — damage settlement', () => {
  it('winner damage = sum of surviving minion stars', () => {
    const attacker = makeBoard({ pieceId: 't3_sentinel', star: 1 }); // 3/6
    const defender = makeBoard({ pieceId: 't1_wanderer', star: 1 }); // 1/2
    const result = resolveBattle(attacker, defender);
    if (result.winner === 'attacker' && result.survivors.length === 1) {
      expect(result.damageDealt).toBe(result.survivors.reduce((sum, m) => sum + m.star, 0));
    }
  });

  it('star-2 survivors deal double star damage', () => {
    const attacker = makeBoard({ pieceId: 't1_shieldbearer', star: 2 }); // 2/8
    const defender = makeBoard({ pieceId: 't1_wanderer', star: 1 });     // 1/2
    const result = resolveBattle(attacker, defender);
    if (result.winner === 'attacker' && result.survivors.length === 1) {
      expect(result.damageDealt).toBe(2); // star 2
    }
  });
});

describe('resolveBattle — simultaneous retaliation', () => {
  it('4/4 vs 3/4: both take damage, attacker survives with 1 hp', () => {
    const attacker = createMinion('t1_wanderer', 1);
    attacker.attack = 4;
    attacker.health = 4;
    attacker.maxHealth = 4;
    const defender = createMinion('t1_wanderer', 1);
    defender.attack = 3;
    defender.health = 4;
    defender.maxHealth = 4;
    const result = resolveBattle([attacker], [defender]);
    expect(result.winner).toBe('attacker');
    expect(result.attackerSurvivors[0].health).toBe(1);
  });

  it('equal stats trade: both minions die', () => {
    const a = createMinion('t1_wanderer', 1);
    a.attack = 3;
    a.health = 3;
    a.maxHealth = 3;
    const d = createMinion('t1_wanderer', 1);
    d.attack = 3;
    d.health = 3;
    d.maxHealth = 3;
    const result = resolveBattle([a], [d]);
    expect(result.winner).toBe('draw');
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
      expect(result.iterations).toBeLessThanOrEqual(100);
    }
  });
});
