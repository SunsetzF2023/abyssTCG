// ============================================================
// Auto-battle engine — AbyssTCG autobattler mode
//
// Pure logic. Given two boards, resolves the battle automatically and
// returns a result with the winner, survivors, and a log of events.
//
// Supported abilities:
//   taunt, deathrattle, shield, cleave, pierce, poison, enrage,
//   firstStrike, frenzy, grow, meditate, onKill, battlecry
// ============================================================

import { getPiece } from './pieces.js';

let _seq = 0;
function nextId() { return 'm' + (++_seq); }

/** Creates a combat minion instance from a piece definition + star level. */
export function createMinion(pieceId, star = 1) {
  const piece = getPiece(pieceId);
  if (!piece) throw new Error('Unknown piece: ' + pieceId);
  const mult = star;
  const m = {
    uid: nextId(),
    pieceId: piece.id,
    name: piece.name,
    race: piece.race,
    tier: piece.tier,
    star,
    attack: piece.attack * mult,
    health: piece.health * mult,
    maxHealth: piece.health * mult,
    ability: piece.ability ? { ...piece.ability } : null,
    shield: piece.ability && piece.ability.type === 'shield',
    hasEnrage: piece.ability && piece.ability.type === 'enrage',
    enrageActive: false,
    canAttack: true,
    isToken: !!piece.isToken,
    // Frenzy pieces attack multiple times per round
    attacksLeft: piece.ability && piece.ability.type === 'frenzy' ? piece.ability.count : 1,
  };
  return m;
}

/** Current effective attack, accounting for enrage. */
function effAttack(m) {
  return m.enrageActive ? m.attack + m.ability.atk : m.attack;
}

/** Picks a target: random Taunt if any, else random alive minion. */
function pickTarget(board) {
  const taunts = board.filter((m) => m.health > 0 && m.ability && m.ability.type === 'taunt');
  const pool = taunts.length > 0 ? taunts : board.filter((m) => m.health > 0);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Applies one instance of damage to a minion, returning true if it died. */
function applyDamage(minion, value) {
  if (value <= 0) return false;
  if (minion.shield) {
    minion.shield = false;
    return false;
  }
  minion.health -= value;
  if (minion.hasEnrage && !minion.enrageActive && minion.health > 0) {
    if (minion.health <= minion.maxHealth / 2) {
      minion.enrageActive = true;
    }
  }
  return minion.health <= 0;
}

/** Deals `value` damage to `target` and returns true if target died. */
function dealDamage(target, value) {
  return applyDamage(target, value);
}

function otherSide(side) { return side === 'attacker' ? 'defender' : 'attacker'; }

// ─── Triggers ────────────────────────────────────────────────

/** Triggers a battlecry (when minion is placed / combat starts). */
function triggerBattlecry(state, m, ownerSide) {
  if (!m.ability || m.ability.type !== 'battlecry') return;
  const ab = m.ability;
  const friendly = state[ownerSide].board;
  switch (ab.subtype) {
    case 'buffRandomAlly':
      buffRandom(friendly, ab, m.uid);
      break;
    case 'buffAdjacentAllies':
      buffAdjacent(friendly, m, ab);
      break;
    case 'buffAlliesIfThree':
      if (friendly.length >= 3) buffAll(friendly, ab, m.uid);
      break;
  }
}

/** Triggers meditation at the start of each combat round. */
function triggerMeditate(state, m, ownerSide) {
  if (!m.ability || m.ability.type !== 'meditate') return;
  const ab = m.ability;
  const friendly = state[ownerSide].board;
  const enemy = state[otherSide(ownerSide)].board;
  switch (ab.subtype) {
    case 'healSelf':
      m.health = Math.min(m.health + ab.value, m.maxHealth);
      break;
    case 'healAdjacentAllies':
      healAdjacent(friendly, m, ab.value);
      break;
    case 'healAllAllies':
      friendly.forEach((x) => { if (x.health > 0) x.health = Math.min(x.health + ab.value, x.maxHealth); });
      break;
    case 'damageRandomEnemy':
      if (enemy.length > 0) dealDamage(enemy[Math.floor(Math.random() * enemy.length)], ab.value);
      break;
    case 'buffAllies':
      buffAll(friendly, ab, m.uid);
      break;
  }
}

/** Triggers an on-kill effect. */
function triggerOnKill(state, killer, ownerSide) {
  if (!killer.ability || killer.ability.type !== 'onKill') return;
  const ab = killer.ability;
  const friendly = state[ownerSide].board;
  switch (ab.subtype) {
    case 'buffSelf':
      killer.attack += ab.atk;
      killer.health += ab.hp;
      killer.maxHealth += ab.hp;
      break;
    case 'gainGold':
      // Hero gold not modeled in combat; instead buff self
      killer.attack += 1;
      killer.health += 1;
      killer.maxHealth += 1;
      break;
    case 'buffAllies':
      buffAll(friendly, ab, killer.uid);
      break;
  }
}

/** Triggers a deathrattle. */
function triggerDeathrattle(state, dyingMinion, ownerSide) {
  if (!dyingMinion.ability || dyingMinion.ability.type !== 'deathrattle') return;
  const ab = dyingMinion.ability;
  const friendlyBoard = state[ownerSide].board;
  const enemyBoard = state[otherSide(ownerSide)].board;

  switch (ab.subtype) {
    case 'summon': {
      for (let i = 0; i < ab.count; i++) {
        if (friendlyBoard.length < 7) friendlyBoard.push(createMinion(ab.token, 1));
      }
      break;
    }
    case 'damageRandomEnemy': {
      const alive = enemyBoard.filter((m) => m.health > 0);
      if (alive.length > 0) dealDamage(alive[Math.floor(Math.random() * alive.length)], ab.value);
      break;
    }
    case 'damageAllEnemies': {
      enemyBoard.forEach((m) => { if (m.health > 0) dealDamage(m, ab.value); });
      break;
    }
    case 'buffAllies': {
      friendlyBoard.forEach((m) => {
        if (m.health > 0 && m.uid !== dyingMinion.uid) {
          m.attack += ab.atk;
          m.health += ab.hp;
          m.maxHealth += ab.hp;
        }
      });
      break;
    }
    case 'weakenAllEnemies': {
      enemyBoard.forEach((m) => {
        if (m.health > 0) {
          m.attack = Math.max(1, m.attack + ab.atk); // atk should be negative
          m.health += ab.hp;
          if (m.health <= 0) {
            triggerDeathrattle(state, m, otherSide(ownerSide));
          }
        }
      });
      break;
    }
  }
}

function buffAll(board, ab, excludeUid) {
  board.forEach((m) => {
    if (m.health > 0 && m.uid !== excludeUid) {
      m.attack += ab.atk;
      m.health += ab.hp;
      m.maxHealth += ab.hp;
    }
  });
}

function buffRandom(board, ab, excludeUid) {
  const alive = board.filter((m) => m.health > 0 && m.uid !== excludeUid);
  if (alive.length === 0) return;
  const target = alive[Math.floor(Math.random() * alive.length)];
  target.attack += ab.atk;
  target.health += ab.hp;
  target.maxHealth += ab.hp;
}

function buffAdjacent(board, m, ab) {
  const idx = board.indexOf(m);
  if (idx === -1) return;
  [idx - 1, idx + 1].forEach((i) => {
    const n = board[i];
    if (n && n.health > 0 && n.uid !== m.uid) {
      n.attack += ab.atk;
      n.health += ab.hp;
      n.maxHealth += ab.hp;
    }
  });
}

function healAdjacent(board, m, value) {
  const idx = board.indexOf(m);
  if (idx === -1) return;
  [idx - 1, idx + 1].forEach((i) => {
    const n = board[i];
    if (n && n.health > 0) n.health = Math.min(n.health + value, n.maxHealth);
  });
}

/** Removes dead minions and triggers their deathrattles. */
function cleanupDead(state, side) {
  let board = state[side].board;
  const dead = board.filter((m) => m.health <= 0);
  dead.forEach((m) => triggerDeathrattle(state, m, side));

  // Weaken may have killed enemy minions; clean both sides
  const both = [side, otherSide(side)];
  both.forEach((s) => {
    const dead2 = state[s].board.filter((m) => m.health <= 0);
    dead2.forEach((m) => {
      if (!state[s].board.includes(m)) return; // already processed
      triggerDeathrattle(state, m, s);
    });
    state[s].board = state[s].board.filter((m) => m.health > 0);
  });
}

/** Runs one attack by `attacker`. Returns the target if attacked. */
function performAttack(state, attackerSide, attacker) {
  const defenderSide = otherSide(attackerSide);
  const target = pickTarget(state[defenderSide].board);
  if (!target) return null;

  const atk = effAttack(attacker);
  const isPoison = attacker.ability && attacker.ability.type === 'poison';
  const isCleave = attacker.ability && attacker.ability.type === 'cleave';
  const isPierce = attacker.ability && attacker.ability.type === 'pierce';

  const enemyBoard = state[defenderSide].board;
  const targetIdx = enemyBoard.indexOf(target);

  // Main hit
  if (isPoison) {
    target.health = 0;
  } else {
    dealDamage(target, atk);
  }

  // Cleave
  if (isCleave) {
    if (targetIdx > 0) {
      const left = enemyBoard[targetIdx - 1];
      if (left && left.health > 0) dealDamage(left, atk);
    }
    if (targetIdx >= 0 && targetIdx < enemyBoard.length - 1) {
      const right = enemyBoard[targetIdx + 1];
      if (right && right.health > 0) dealDamage(right, atk);
    }
  }

  // Pierce — also hit minion behind the target
  if (isPierce) {
    if (targetIdx >= 0 && targetIdx < enemyBoard.length - 1) {
      const behind = enemyBoard[targetIdx + 1];
      if (behind && behind.health > 0) dealDamage(behind, atk);
    }
  }

  // Target retaliates if still alive
  const targetWasAlive = target.health > 0;
  if (targetWasAlive) {
    const targetIsPoison = target.ability && target.ability.type === 'poison';
    if (targetIsPoison) {
      attacker.health = 0;
    } else {
      dealDamage(attacker, target.attack);
    }
  }

  cleanupDead(state, attackerSide);
  cleanupDead(state, defenderSide);

  // On-kill check
  if (target.health <= 0 && attacker.health > 0) {
    triggerOnKill(state, attacker, attackerSide);
  }

  state.log.push({
    type: 'attack',
    attacker: attacker.name,
    target: target.name,
    side: attackerSide,
  });

  return target;
}

/** Builds attack order alternating sides, leftmost-first. */
function buildAttackOrder(state) {
  const order = [];
  const a = state.attacker.board.filter((m) => m.health > 0);
  const d = state.defender.board.filter((m) => m.health > 0);
  const max = Math.max(a.length, d.length);
  for (let i = 0; i < max; i++) {
    if (a[i]) order.push({ side: 'attacker', minion: a[i] });
    if (d[i]) order.push({ side: 'defender', minion: d[i] });
  }
  return order;
}

/** Resolves one full round of attacks (each surviving minion gets to attack). */
function combatRound(state) {
  // Round start: grow, meditate, refresh shield, reset attacks
  for (const side of ['attacker', 'defender']) {
    for (const m of state[side].board) {
      if (m.health <= 0) continue;
      // Refresh shield if base ability is shield
      if (m.ability && m.ability.type === 'shield') m.shield = true;
      // Grow
      if (m.ability && m.ability.type === 'grow') {
        m.attack += m.ability.atk;
        m.health += m.ability.hp;
        m.maxHealth += m.ability.hp;
      }
      // Meditate
      triggerMeditate(state, m, side);
      // Reset attacks
      m.attacksLeft = m.ability && m.ability.type === 'frenzy' ? m.ability.count : 1;
    }
  }

  // First strike — one extra attack for each first-strike minion, in order
  const allFirst = [];
  for (const side of ['attacker', 'defender']) {
    for (const m of state[side].board) {
      if (m.health > 0 && m.ability && m.ability.type === 'firstStrike') {
        allFirst.push({ side, minion: m });
      }
    }
  }
  // First-strike attackers act alternately, attacker side first
  allFirst.sort((a, b) => (a.side === 'attacker' ? -1 : 1) - (b.side === 'attacker' ? -1 : 1));
  for (const { side, minion } of allFirst) {
    if (minion.health > 0) {
      const attacker = state[side].board.find((x) => x.uid === minion.uid);
      if (attacker) performAttack(state, side, attacker);
    }
  }

  // Main attack loop
  let anyAttack = false;
  const attackOrder = buildAttackOrder(state);
  if (attackOrder.length === 0) return false;

  for (const entry of attackOrder) {
    if (state.attacker.board.length === 0 || state.defender.board.length === 0) break;

    const stillAlive = state[entry.side].board.find((m) => m.uid === entry.minion.uid);
    if (!stillAlive || stillAlive.attacksLeft <= 0) continue;

    while (stillAlive.attacksLeft > 0 && stillAlive.health > 0) {
      stillAlive.attacksLeft--;
      anyAttack = true;
      performAttack(state, entry.side, stillAlive);
      if (state.attacker.board.length === 0 || state.defender.board.length === 0) break;
      if (stillAlive.attacksLeft <= 0) break;
      // For frenzy, the same target may have died; pick a new one next attack
    }
  }

  return anyAttack;
}

/** Resolves a full battle between two boards. */
export function resolveBattle(attackerBoard, defenderBoard) {
  const clone = (m) => ({
    ...m,
    ability: m.ability ? { ...m.ability } : null,
  });
  const state = {
    attacker: { board: attackerBoard.map(clone) },
    defender: { board: defenderBoard.map(clone) },
    log: [],
  };

  // Battlecry on combat start
  for (const side of ['attacker', 'defender']) {
    for (const m of state[side].board) {
      triggerBattlecry(state, m, side);
    }
  }
  cleanupDead(state, 'attacker');
  cleanupDead(state, 'defender');

  let safety = 0;
  const MAX_ITERATIONS = 100;
  while (state.attacker.board.length > 0 && state.defender.board.length > 0 && safety < MAX_ITERATIONS) {
    safety++;
    if (!combatRound(state)) break;
  }

  const aAlive = state.attacker.board.length;
  const dAlive = state.defender.board.length;
  let winner;
  let survivors;
  let damageDealt = 0;

  if (aAlive === 0 && dAlive === 0) {
    winner = 'draw';
    survivors = [];
  } else if (dAlive === 0) {
    winner = 'attacker';
    survivors = state.attacker.board;
  } else {
    winner = 'defender';
    survivors = state.defender.board;
  }

  if (winner !== 'draw') {
    damageDealt = survivors.reduce((sum, m) => sum + m.tier * m.star, 0);
  }

  return {
    winner,
    survivors: survivors.map((m) => ({ ...m })),
    damageDealt,
    log: state.log,
    iterations: safety,
  };
}

/** Helper: creates a board of minions from { pieceId, star } specs. */
export function makeBoard(...specs) {
  return specs.map((s) => createMinion(s.pieceId, s.star || 1));
}
