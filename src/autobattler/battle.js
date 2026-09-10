// ============================================================
// Auto-battle engine — AbyssTCG autobattler mode
//
// Pure logic. Given two 6-slot boards (3 front + 3 back), resolves
// the battle automatically and returns a result.
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
    attacksLeft: piece.ability && piece.ability.type === 'frenzy' ? piece.ability.count : 1,
  };
  return m;
}

/** Current effective attack, accounting for enrage. */
function effAttack(m) {
  return m.enrageActive ? m.attack + m.ability.atk : m.attack;
}

/** Picks a target: front-row Taunt > front-row > back-row Taunt > back-row. */
function pickTarget(board) {
  const alive = (m) => m && m.health > 0;
  const front = board.slice(0, 3).filter(alive);
  const back = board.slice(3, 6).filter(alive);

  function pick(pool) {
    if (pool.length === 0) return null;
    const taunts = pool.filter((m) => m.ability && m.ability.type === 'taunt');
    const candidates = taunts.length > 0 ? taunts : pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  return pick(front) || pick(back);
}

function posOf(board, m) { return board.indexOf(m); }

function logEvent(state, event) {
  state.log.push(event);
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
    if (minion.health <= minion.maxHealth / 2) minion.enrageActive = true;
  }
  return minion.health <= 0;
}

function otherSide(side) { return side === 'attacker' ? 'defender' : 'attacker'; }

// ─── Triggers ────────────────────────────────────────────────

function triggerBattlecry(state, m, ownerSide) {
  if (!m.ability || m.ability.type !== 'battlecry' || m.battlecryTriggered) return;
  m.battlecryTriggered = true;
  const ab = m.ability;
  const friendly = state[ownerSide].board.filter(Boolean);
  const mPos = posOf(state[ownerSide].board, m);
  switch (ab.subtype) {
    case 'buffRandomAlly':
      buffRandom(friendly, ab, m.uid);
      break;
    case 'buffAdjacentAllies':
      buffAdjacent(state[ownerSide].board, m, ab);
      break;
    case 'buffAlliesIfThree':
      if (friendly.length >= 3) buffAll(friendly, ab, m.uid);
      break;
  }
  logEvent(state, {
    type: 'battlecry',
    side: ownerSide,
    sourceUid: m.uid,
    sourceName: m.name,
    sourcePos: mPos,
    subtype: ab.subtype,
    atk: ab.atk,
    hp: ab.hp,
  });
}

function triggerMeditate(state, m, ownerSide) {
  if (!m.ability || m.ability.type !== 'meditate') return;
  const ab = m.ability;
  const friendly = state[ownerSide].board.filter(Boolean);
  const enemy = state[otherSide(ownerSide)].board.filter(Boolean);
  const mPos = posOf(state[ownerSide].board, m);
  switch (ab.subtype) {
    case 'healSelf':
      m.health = Math.min(m.health + ab.value, m.maxHealth);
      logEvent(state, {
        type: 'heal',
        side: ownerSide,
        targetUid: m.uid,
        targetName: m.name,
        targetPos: mPos,
        value: ab.value,
        subtype: 'meditate',
      });
      break;
    case 'healAdjacentAllies':
      healAdjacent(state, ownerSide, state[ownerSide].board, m, ab.value);
      break;
    case 'healAllAllies':
      friendly.forEach((x) => {
        if (x.health > 0) {
          const old = x.health;
          x.health = Math.min(x.health + ab.value, x.maxHealth);
          const actual = x.health - old;
          if (actual > 0) {
            logEvent(state, {
              type: 'heal',
              side: ownerSide,
              targetUid: x.uid,
              targetName: x.name,
              targetPos: posOf(state[ownerSide].board, x),
              value: actual,
              subtype: 'meditate',
            });
          }
        }
      });
      break;
    case 'damageRandomEnemy':
      if (enemy.length > 0) {
        const t = enemy[Math.floor(Math.random() * enemy.length)];
        const enemySide = otherSide(ownerSide);
        applyDamage(t, ab.value);
        logEvent(state, {
          type: 'damage',
          side: enemySide,
          targetUid: t.uid,
          targetName: t.name,
          targetPos: posOf(state[enemySide].board, t),
          damage: ab.value,
          subtype: 'meditate',
        });
      }
      break;
    case 'buffAllies':
      buffAll(friendly, ab, m.uid);
      break;
  }
}

function triggerOnKill(state, killer, ownerSide) {
  if (!killer.ability || killer.ability.type !== 'onKill') return;
  const ab = killer.ability;
  const friendly = state[ownerSide].board.filter(Boolean);
  const killerPos = posOf(state[ownerSide].board, killer);
  switch (ab.subtype) {
    case 'buffSelf':
      killer.attack += ab.atk;
      killer.health += ab.hp;
      killer.maxHealth += ab.hp;
      break;
    case 'gainGold':
      killer.attack += 1;
      killer.health += 1;
      killer.maxHealth += 1;
      break;
    case 'buffAllies':
      buffAll(friendly, ab, killer.uid);
      break;
  }
  logEvent(state, {
    type: 'onKill',
    side: ownerSide,
    sourceUid: killer.uid,
    sourceName: killer.name,
    sourcePos: killerPos,
    subtype: ab.subtype,
    atk: ab.atk,
    hp: ab.hp,
  });
}

function triggerDeathrattle(state, dyingMinion, ownerSide) {
  if (!dyingMinion.ability || dyingMinion.ability.type !== 'deathrattle') return;
  const ab = dyingMinion.ability;
  const friendlyBoard = state[ownerSide].board;
  const enemyBoard = state[otherSide(ownerSide)].board;
  const dyingPos = posOf(state[ownerSide].board, dyingMinion);

  switch (ab.subtype) {
    case 'summon': {
      for (let i = 0; i < ab.count; i++) {
        const emptyIdx = friendlyBoard.findIndex((m) => m === null || m.health <= 0);
        if (emptyIdx !== -1) {
          const summoned = createMinion(ab.token, 1);
          friendlyBoard[emptyIdx] = summoned;
          logEvent(state, {
            type: 'summon',
            side: ownerSide,
            targetUid: summoned.uid,
            targetName: summoned.name,
            targetPos: emptyIdx,
            sourceName: dyingMinion.name,
            sourcePos: dyingPos,
          });
        }
      }
      break;
    }
    case 'damageRandomEnemy': {
      const alive = enemyBoard.filter((m) => m && m.health > 0);
      if (alive.length > 0) {
        const t = alive[Math.floor(Math.random() * alive.length)];
        const enemySide = otherSide(ownerSide);
        applyDamage(t, ab.value);
        logEvent(state, {
          type: 'damage',
          side: enemySide,
          targetUid: t.uid,
          targetName: t.name,
          targetPos: posOf(state[enemySide].board, t),
          damage: ab.value,
          subtype: 'deathrattle',
        });
      }
      break;
    }
    case 'damageAllEnemies': {
      const enemySide = otherSide(ownerSide);
      enemyBoard.forEach((m) => {
        if (m && m.health > 0) {
          applyDamage(m, ab.value);
          logEvent(state, {
            type: 'damage',
            side: enemySide,
            targetUid: m.uid,
            targetName: m.name,
            targetPos: posOf(state[enemySide].board, m),
            damage: ab.value,
            subtype: 'deathrattle',
          });
        }
      });
      break;
    }
    case 'buffAllies': {
      friendlyBoard.forEach((m) => {
        if (m && m.health > 0 && m.uid !== dyingMinion.uid) {
          m.attack += ab.atk;
          m.health += ab.hp;
          m.maxHealth += ab.hp;
          logEvent(state, {
            type: 'buff',
            side: ownerSide,
            targetUid: m.uid,
            targetName: m.name,
            targetPos: posOf(state[ownerSide].board, m),
            atk: ab.atk,
            hp: ab.hp,
            subtype: 'deathrattle',
          });
        }
      });
      break;
    }
    case 'weakenAllEnemies': {
      const enemySide = otherSide(ownerSide);
      enemyBoard.forEach((m) => {
        if (m && m.health > 0) {
          m.attack = Math.max(1, m.attack + ab.atk);
          m.health += ab.hp;
          if (m.health <= 0) triggerDeathrattle(state, m, enemySide);
          logEvent(state, {
            type: 'debuff',
            side: enemySide,
            targetUid: m.uid,
            targetName: m.name,
            targetPos: posOf(state[enemySide].board, m),
            atk: ab.atk,
            hp: ab.hp,
            subtype: 'deathrattle',
          });
        }
      });
      break;
    }
  }
}

function buffAll(board, ab, excludeUid) {
  board.forEach((m) => {
    if (m && m.health > 0 && m.uid !== excludeUid) {
      m.attack += ab.atk;
      m.health += ab.hp;
      m.maxHealth += ab.hp;
    }
  });
}

function buffRandom(board, ab, excludeUid) {
  const alive = board.filter((m) => m && m.health > 0 && m.uid !== excludeUid);
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

function healAdjacent(state, side, board, m, value) {
  const idx = board.indexOf(m);
  if (idx === -1) return;
  [idx - 1, idx + 1].forEach((i) => {
    const n = board[i];
    if (n && n.health > 0) {
      const old = n.health;
      n.health = Math.min(n.health + value, n.maxHealth);
      const actual = n.health - old;
      if (actual > 0) {
        logEvent(state, {
          type: 'heal',
          side,
          targetUid: n.uid,
          targetName: n.name,
          targetPos: i,
          value: actual,
          subtype: 'meditate',
        });
      }
    }
  });
}

/** Removes dead minions and triggers their deathrattles. */
function cleanupDead(state, side) {
  const board = state[side].board;
  const other = otherSide(side);

  // Trigger deathrattles for each dead minion
  board.forEach((m) => {
    if (m && m.health <= 0) triggerDeathrattle(state, m, side);
  });
  state[other].board.forEach((m) => {
    if (m && m.health <= 0) triggerDeathrattle(state, m, other);
  });

  // Clear dead minions from slots
  ['attacker', 'defender'].forEach((s) => {
    state[s].board = state[s].board.map((m) => (m && m.health > 0 ? m : null));
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

  const myBoard = state[attackerSide].board;
  const enemyBoard = state[defenderSide].board;
  const attackerPos = posOf(myBoard, attacker);
  const targetIdx = posOf(enemyBoard, target);

  // Main hit
  let mainDamage;
  if (isPoison) {
    mainDamage = target.health;
    target.health = 0;
  } else {
    mainDamage = atk;
    applyDamage(target, atk);
  }

  logEvent(state, {
    type: 'attack',
    side: attackerSide,
    attackerUid: attacker.uid,
    attackerName: attacker.name,
    attackerPos,
    targetUid: target.uid,
    targetName: target.name,
    targetPos: targetIdx,
    damage: mainDamage,
    isPoison,
  });

  // Cleave
  if (isCleave) {
    if (targetIdx > 0) {
      const left = enemyBoard[targetIdx - 1];
      if (left && left.health > 0) {
        applyDamage(left, atk);
        logEvent(state, {
          type: 'splash',
          side: defenderSide,
          targetUid: left.uid,
          targetName: left.name,
          targetPos: targetIdx - 1,
          damage: atk,
          subtype: 'cleave',
        });
      }
    }
    if (targetIdx >= 0 && targetIdx < enemyBoard.length - 1) {
      const right = enemyBoard[targetIdx + 1];
      if (right && right.health > 0) {
        applyDamage(right, atk);
        logEvent(state, {
          type: 'splash',
          side: defenderSide,
          targetUid: right.uid,
          targetName: right.name,
          targetPos: targetIdx + 1,
          damage: atk,
          subtype: 'cleave',
        });
      }
    }
  }

  // Pierce
  if (isPierce) {
    if (targetIdx >= 0 && targetIdx < enemyBoard.length - 1) {
      const behind = enemyBoard[targetIdx + 1];
      if (behind && behind.health > 0) {
        applyDamage(behind, atk);
        logEvent(state, {
          type: 'splash',
          side: defenderSide,
          targetUid: behind.uid,
          targetName: behind.name,
          targetPos: targetIdx + 1,
          damage: atk,
          subtype: 'pierce',
        });
      }
    }
  }

  // Target retaliates if still alive
  if (target.health > 0) {
    const targetIsPoison = target.ability && target.ability.type === 'poison';
    if (targetIsPoison) {
      attacker.health = 0;
      logEvent(state, {
        type: 'counter',
        side: attackerSide,
        targetUid: attacker.uid,
        targetName: attacker.name,
        targetPos: attackerPos,
        damage: attacker.health,
        isPoison: true,
      });
    } else {
      applyDamage(attacker, target.attack);
      logEvent(state, {
        type: 'counter',
        side: attackerSide,
        targetUid: attacker.uid,
        targetName: attacker.name,
        targetPos: attackerPos,
        damage: target.attack,
      });
    }
  }

  cleanupDead(state, attackerSide);

  // On-kill check
  if (target.health <= 0 && attacker.health > 0) {
    triggerOnKill(state, attacker, attackerSide);
  }

  return target;
}

/** Builds attack order: left-to-right across the 6 slots, alternating sides. */
function buildAttackOrder(state) {
  const order = [];
  const max = Math.max(state.attacker.board.length, state.defender.board.length);
  for (let i = 0; i < max; i++) {
    const a = state.attacker.board[i];
    const d = state.defender.board[i];
    if (a) order.push({ side: 'attacker', minion: a });
    if (d) order.push({ side: 'defender', minion: d });
  }
  return order;
}

function minionsAlive(board) {
  return board.filter((m) => m && m.health > 0).length;
}

/** Resolves one full round of attacks. */
function combatRound(state) {
  // Round start: grow, meditate, refresh shields, reset attacks
  for (const side of ['attacker', 'defender']) {
    for (const m of state[side].board) {
      if (!m || m.health <= 0) continue;
      if (m.ability && m.ability.type === 'shield') m.shield = true;
      if (m.ability && m.ability.type === 'grow') {
        m.attack += m.ability.atk;
        m.health += m.ability.hp;
        m.maxHealth += m.ability.hp;
        logEvent(state, {
          type: 'buff',
          side,
          targetUid: m.uid,
          targetName: m.name,
          targetPos: posOf(state[side].board, m),
          atk: m.ability.atk,
          hp: m.ability.hp,
          subtype: 'grow',
        });
      }
      triggerMeditate(state, m, side);
      m.attacksLeft = m.ability && m.ability.type === 'frenzy' ? m.ability.count : 1;
    }
  }

  // First strike
  const allFirst = [];
  for (const side of ['attacker', 'defender']) {
    for (let i = 0; i < state[side].board.length; i++) {
      const m = state[side].board[i];
      if (m && m.health > 0 && m.ability && m.ability.type === 'firstStrike') {
        allFirst.push({ side, minion: m });
      }
    }
  }
  allFirst.sort((a, b) => (a.side === 'attacker' ? -1 : 1) - (b.side === 'attacker' ? -1 : 1));
  for (const { side, minion } of allFirst) {
    if (minion.health > 0) {
      const attacker = state[side].board.find((x) => x && x.uid === minion.uid);
      if (attacker) {
        logEvent(state, {
          type: 'firstStrike',
          side,
          sourceUid: attacker.uid,
          sourceName: attacker.name,
          sourcePos: posOf(state[side].board, attacker),
        });
        performAttack(state, side, attacker);
      }
    }
  }

  // Main attack loop
  let anyAttack = false;
  const attackOrder = buildAttackOrder(state);
  if (attackOrder.length === 0) return false;

  for (const entry of attackOrder) {
    if (minionsAlive(state.attacker.board) === 0 || minionsAlive(state.defender.board) === 0) break;

    const stillAlive = state[entry.side].board.find((m) => m && m.uid === entry.minion.uid);
    if (!stillAlive || stillAlive.attacksLeft <= 0) continue;

    while (stillAlive.attacksLeft > 0 && stillAlive.health > 0) {
      stillAlive.attacksLeft--;
      anyAttack = true;
      performAttack(state, entry.side, stillAlive);
      if (minionsAlive(state.attacker.board) === 0 || minionsAlive(state.defender.board) === 0) break;
    }
  }

  return anyAttack;
}

/** Resolves a full battle between two 6-slot boards. */
export function resolveBattle(attackerBoard, defenderBoard) {
  // Pad or clone boards to 6-slot arrays with nulls
  const clone = (m) => m ? { ...m, ability: m.ability ? { ...m.ability } : null } : null;
  const normalize = (board) => {
    const arr = new Array(6).fill(null);
    for (let i = 0; i < Math.min(board.length, 6); i++) {
      arr[i] = clone(board[i]);
    }
    return arr;
  };

  const state = {
    attacker: { board: normalize(attackerBoard) },
    defender: { board: normalize(defenderBoard) },
    log: [],
    initialBoards: {
      attacker: normalize(attackerBoard),
      defender: normalize(defenderBoard),
    },
  };

  // Battlecry on combat start
  for (const side of ['attacker', 'defender']) {
    for (const m of state[side].board) {
      if (m) triggerBattlecry(state, m, side);
    }
  }
  cleanupDead(state, 'attacker');

  let safety = 0;
  const MAX_ITERATIONS = 100;
  while (minionsAlive(state.attacker.board) > 0 && minionsAlive(state.defender.board) > 0 && safety < MAX_ITERATIONS) {
    safety++;
    if (!combatRound(state)) break;
  }

  const aAlive = minionsAlive(state.attacker.board);
  const dAlive = minionsAlive(state.defender.board);
  let winner;
  let survivors;
  let damageDealt = 0;

  if (aAlive === 0 && dAlive === 0) {
    winner = 'draw';
    survivors = [];
  } else if (dAlive === 0) {
    winner = 'attacker';
    survivors = state.attacker.board.filter(Boolean);
  } else {
    winner = 'defender';
    survivors = state.defender.board.filter(Boolean);
  }

  const attackerSurvivors = state.attacker.board.filter(Boolean);
  const defenderSurvivors = state.defender.board.filter(Boolean);

  if (winner !== 'draw') {
    damageDealt = survivors.reduce((sum, m) => sum + m.tier * m.star, 0);
  }

  return {
    winner,
    survivors: survivors.map((m) => ({ ...m })),
    attackerSurvivors: attackerSurvivors.map((m) => ({ ...m })),
    defenderSurvivors: defenderSurvivors.map((m) => ({ ...m })),
    damageDealt,
    log: state.log,
    initialBoards: state.initialBoards,
    iterations: safety,
  };
}

/** Helper: creates a board of minions from { pieceId, star } specs. */
export function makeBoard(...specs) {
  return specs.map((s) => createMinion(s.pieceId, s.star || 1));
}
