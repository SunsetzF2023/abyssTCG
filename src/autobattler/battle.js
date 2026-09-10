// ============================================================
// Auto-battle engine — AbyssTCG autobattler mode
//
// Pure logic, no DOM access. Given two boards (arrays of combat
// minions with positions), resolves the battle automatically and
// returns a result with the winner, survivors, and a log of events.
//
// Combat flow (Hearthstone Battlegrounds / 月圆之夜 style):
//   1. Each side's minions attack in position order (leftmost first).
//   2. The two sides alternate attacks. The side with more minions
//      gets the extra attacks at the end.
//   3. An attacker picks a target: a random enemy Taunt minion if
//      any exist, otherwise a random enemy minion.
//   4. The attacker deals its attack value as damage to the target,
//      and the target deals its attack value back to the attacker
//      (mutual trade, like Hearthstone minion combat).
//   5. Abilities trigger at the right moments:
//        - divineShield: absorbs the first damage instance
//        - poison: any damage dealt is lethal
//        - cleave: attack also hits adjacent enemies
//        - enrage: while below 50% hp, gains bonus attack
//        - deathrattle: triggers on death (summon / damage / buff)
//        - taunt: forces enemies to target this minion
//   6. Battle ends when one side has no minions left (or both).
//   7. Winner deals damage to loser = sum of surviving minions'
//      (tier * star) values.
// ============================================================

import { getPiece } from './pieces.js';

let _seq = 0;
function nextId() { return 'm' + (++_seq); }

/** Creates a combat minion instance from a piece definition + star level. */
export function createMinion(pieceId, star = 1) {
  const piece = getPiece(pieceId);
  if (!piece) throw new Error('Unknown piece: ' + pieceId);
  const mult = star; // star 1 = 1x, star 2 = 2x, star 3 = 3x
  return {
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
    divineShield: piece.ability && piece.ability.type === 'divineShield',
    hasEnrage: piece.ability && piece.ability.type === 'enrage',
    enrageActive: false,
    canAttack: true,
    isToken: !!piece.isToken,
  };
}

/** Current effective attack, accounting for enrage. */
function effAttack(m) {
  return m.enrageActive ? m.attack + m.ability.atk : m.attack;
}

/** Picks a target for the attacker: random taunt if any, else random minion. */
function pickTarget(board) {
  const taunts = board.filter((m) => m.health > 0 && m.ability && m.ability.type === 'taunt');
  const pool = taunts.length > 0 ? taunts : board.filter((m) => m.health > 0);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Deals `value` damage to a minion, consuming divine shield first.
 *  Returns true if the minion died from this damage. */
function dealDamage(minion, value) {
  if (value <= 0) return false;
  if (minion.divineShield) {
    minion.divineShield = false;
    return false;
  }
  minion.health -= value;
  // Check enrage threshold (below 50% of maxHealth)
  if (minion.hasEnrage && !minion.enrageActive && minion.health > 0) {
    if (minion.health <= minion.maxHealth / 2) {
      minion.enrageActive = true;
    }
  }
  return minion.health <= 0;
}

/** Handles a deathrattle trigger for a dying minion. */
function triggerDeathrattle(state, dyingMinion, ownerSide) {
  if (!dyingMinion.ability || dyingMinion.ability.type !== 'deathrattle') return;
  const ab = dyingMinion.ability;
  const friendlyBoard = state[ownerSide].board;
  const enemyBoard = state[otherSide(ownerSide)].board;

  switch (ab.subtype) {
    case 'summon': {
      for (let i = 0; i < ab.count; i++) {
        if (friendlyBoard.length < 7) {
          friendlyBoard.push(createMinion(ab.token, 1));
        }
      }
      break;
    }
    case 'damageRandomEnemy': {
      const alive = enemyBoard.filter((m) => m.health > 0);
      if (alive.length > 0) {
        const target = alive[Math.floor(Math.random() * alive.length)];
        dealDamage(target, ab.value);
      }
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
  }
}

function otherSide(side) {
  return side === 'attacker' ? 'defender' : 'attacker';
}

/** Removes dead minions from a board, triggering deathrattles in order. */
function cleanupDead(state, side) {
  const board = state[side].board;
  const dead = board.filter((m) => m.health <= 0);
  dead.forEach((m) => triggerDeathrattle(state, m, side));
  state[side].board = board.filter((m) => m.health > 0);
  // Deathrattles may have killed more minions (damageRandomEnemy) or
  // summoned new ones; do a final cleanup of the enemy board too.
  const enemySide = otherSide(side);
  const enemyDead = state[enemySide].board.filter((m) => m.health <= 0);
  enemyDead.forEach((m) => triggerDeathrattle(state, m, enemySide));
  state[enemySide].board = state[enemySide].board.filter((m) => m.health > 0);
}

/** Performs one attack action by `attacker` against the enemy board. */
function performAttack(state, attackerSide, attacker) {
  const defenderSide = otherSide(attackerSide);
  const target = pickTarget(state[defenderSide].board);
  if (!target) return;

  const atk = effAttack(attacker);
  const isPoison = attacker.ability && attacker.ability.type === 'poison';
  const isCleave = attacker.ability && attacker.ability.type === 'cleave';

  // Find target index for cleave adjacency
  const enemyBoard = state[defenderSide].board;
  const targetIdx = enemyBoard.indexOf(target);

  // Main hit
  if (isPoison) {
    target.health = 0; // poison is lethal
  } else {
    dealDamage(target, atk);
  }

  // Cleave: damage adjacent enemies
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

  // Target retaliates against attacker (mutual trade)
  if (target.health > 0) {
    const targetIsPoison = target.ability && target.ability.type === 'poison';
    if (targetIsPoison) {
      attacker.health = 0;
    } else {
      dealDamage(attacker, target.attack);
    }
  }

  state.log.push({
    type: 'attack',
    attacker: attacker.name,
    target: target.name,
    side: attackerSide,
  });

  // Cleanup dead on both sides
  cleanupDead(state, attackerSide);
  cleanupDead(state, defenderSide);
}

/** Builds the attack order: alternating sides, leftmost-first within each side.
 *  Returns an array of { side, minion } in the order they attack. */
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

/** Resolves a full battle between two boards.
 *  attackerBoard / defenderBoard: arrays of minion objects (from createMinion).
 *  Returns { winner, survivors, damageDealt, log }.
 *  winner: 'attacker' | 'defender' | 'draw' */
export function resolveBattle(attackerBoard, defenderBoard) {
  // Deep-clone the boards so the caller's minions aren't mutated.
  const cloneBoard = (board) => board.map((m) => ({ ...m }));
  const state = {
    attacker: { board: cloneBoard(attackerBoard) },
    defender: { board: cloneBoard(defenderBoard) },
    log: [],
  };

  let safety = 0;
  const MAX_ITERATIONS = 500;

  while (state.attacker.board.length > 0 && state.defender.board.length > 0 && safety < MAX_ITERATIONS) {
    safety++;

    // Rebuild attack order each round so summoned minions are included.
    const attackOrder = buildAttackOrder(state);
    if (attackOrder.length === 0) break;

    let anyAttack = false;
    for (const entry of attackOrder) {
      if (state.attacker.board.length === 0 || state.defender.board.length === 0) break;
      safety++;
      if (safety >= MAX_ITERATIONS) break;

      const stillAlive = entry.side === 'attacker'
        ? state.attacker.board.find((m) => m.uid === entry.minion.uid)
        : state.defender.board.find((m) => m.uid === entry.minion.uid);
      if (!stillAlive || !stillAlive.canAttack) continue;

      stillAlive.canAttack = false;
      anyAttack = true;
      performAttack(state, entry.side, stillAlive);
    }

    // Reset canAttack for next round
    state.attacker.board.forEach((m) => { m.canAttack = true; });
    state.defender.board.forEach((m) => { m.canAttack = true; });

    // Safety: if no one could attack (shouldn't happen), break
    if (!anyAttack) break;
  }

  // Determine winner
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

  // Damage dealt to loser = sum of surviving minions' (tier * star)
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

/** Helper: creates a board of minions from a list of { pieceId, star } specs. */
export function makeBoard(...specs) {
  return specs.map((s) => createMinion(s.pieceId, s.star || 1));
}
