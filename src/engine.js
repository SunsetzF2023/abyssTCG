// ============================================================
// Game engine — AbyssTCG
//
// Pure logic, no DOM access. src/game.js renders GameState and
// calls into these functions in response to clicks.
//
// MVP scope (deliberately excluded for now, see README roadmap):
//   - keywords (taunt / charge / lifesteal / deathrattle)
//   - hero powers
//   - deck building UI (decks are auto-built: 2 copies of every
//     card owned by the chosen faction, shuffled)
// ============================================================

import { cardsForFaction, getCard } from './cards.js';

const BOARD_LIMIT = 7;
const HAND_LIMIT = 10;
const HERO_MAX_HP = 30;
const MANA_CAP = 10;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function buildDeck(factionId) {
  const pool = cardsForFaction(factionId);
  let deck = [];
  pool.forEach(c => { deck.push(c.id); deck.push(c.id); });
  // Pad or trim to exactly 30 so every faction feels the same length,
  // even though the MVP card pool per faction isn't 15 unique cards yet.
  let i = 0;
  while (deck.length < 30) { deck.push(pool[i % pool.length].id); i++; }
  deck = deck.slice(0, 30);
  return shuffle(deck);
}

function newPlayerState(side, factionId) {
  return {
    side,
    factionId,
    heroHp: HERO_MAX_HP,
    heroMaxHp: HERO_MAX_HP,
    manaMax: 0,
    manaCur: 0,
    deck: buildDeck(factionId),
    hand: [],
    board: [],
    fatigue: 0,
  };
}

function drawCard(game, side) {
  const p = game[side];
  if (p.deck.length === 0) {
    p.fatigue += 1;
    p.heroHp -= p.fatigue;
    game.log.push({ text: `${sideName(side)} 牌库已空，受到 ${p.fatigue} 点疲劳伤害！`, cls: 'bad' });
    checkWin(game);
    return;
  }
  if (p.hand.length >= HAND_LIMIT) {
    const burned = p.deck.pop();
    game.log.push({ text: `${sideName(side)} 手牌已满，${getCard(burned).name} 被烧毁！`, cls: 'bad' });
    return;
  }
  const cardId = p.deck.pop();
  p.hand.push({ uid: uid('c'), cardId });
}

function sideName(side) {
  return side === 'player' ? '你' : '对手';
}

function otherSide(side) {
  return side === 'player' ? 'ai' : 'player';
}

export function newGame(playerFactionId, aiFactionId) {
  const game = {
    turnCount: 0,
    active: 'player',
    player: newPlayerState('player', playerFactionId),
    ai: newPlayerState('ai', aiFactionId),
    over: false,
    winner: null,
    log: [],
  };
  for (let i = 0; i < 3; i++) drawCard(game, 'player');
  for (let i = 0; i < 4; i++) drawCard(game, 'ai');
  startTurn(game, 'player');
  return game;
}

export function startTurn(game, side) {
  const p = game[side];
  game.active = side;
  game.turnCount += 1;
  p.manaMax = Math.min(MANA_CAP, p.manaMax + 1);
  p.manaCur = p.manaMax;
  p.board.forEach(m => { m.canAttack = true; });
  drawCard(game, side);
  game.log.push({ text: `── ${sideName(side)} 的回合（第 ${game.turnCount} 回合） ──`, cls: 'info' });
}

function revertTempBuffs(side_player_state) {
  side_player_state.board.forEach(m => {
    if (m.tempBuff) {
      m.attack -= m.tempBuff.atk;
      m.health -= m.tempBuff.hp;
      m.maxHealth -= m.tempBuff.hp;
      m.tempBuff = null;
    }
  });
  // Minions killed by their own buff wearing off (health <= 0) are removed.
  side_player_state.board = side_player_state.board.filter(m => m.health > 0);
}

export function endTurn(game) {
  if (game.over) return;
  const side = game.active;
  revertTempBuffs(game[side]);
  const next = otherSide(side);
  startTurn(game, next);
  if (next === 'ai') runAiTurn(game);
}

export function checkWin(game) {
  if (game.player.heroHp <= 0 || game.ai.heroHp <= 0) {
    game.over = true;
    if (game.player.heroHp <= 0 && game.ai.heroHp <= 0) game.winner = 'draw';
    else game.winner = game.player.heroHp <= 0 ? 'ai' : 'player';
    game.log.push({ text: game.winner === 'draw' ? '双方同时倒下，平局！' : `${sideName(game.winner)} 获胜！`, cls: 'info' });
  }
}

export function requiresMinionTarget(card) {
  if (!card.effect) return false; // minions have no effect object
  const steps = card.effect.type === 'composite' ? card.effect.steps : [card.effect];
  return steps.some(s => ['damageMinion', 'buffMinionTemp', 'damageMinionThenBuffRandomIfDied', 'damageMinionThenDrawIfDied'].includes(s.type));
}

function findMinion(game, uidStr) {
  for (const side of ['player', 'ai']) {
    const m = game[side].board.find(m => m.uid === uidStr);
    if (m) return { side, minion: m };
  }
  return null;
}

function dealDamageToMinion(game, minionRef, value) {
  minionRef.minion.health -= value;
  game.log.push({ text: `${minionRef.minion.name} 受到 ${value} 点伤害`, cls: 'bad' });
  if (minionRef.minion.health <= 0) {
    game.log.push({ text: `${minionRef.minion.name} 被消灭`, cls: 'bad' });
    game[minionRef.side].board = game[minionRef.side].board.filter(m => m.uid !== minionRef.minion.uid);
    return true;
  }
  return false;
}

function resolveStep(game, step, casterSide, targetUid) {
  const opponentSide = otherSide(casterSide);
  switch (step.type) {
    case 'damageMinion': {
      const ref = findMinion(game, targetUid);
      if (ref) dealDamageToMinion(game, ref, step.value);
      break;
    }
    case 'damageAllMinions': {
      const side = step.side === 'enemy' ? opponentSide : casterSide;
      const board = game[side].board.slice();
      board.forEach(m => dealDamageToMinion(game, { side, minion: m }, step.value));
      break;
    }
    case 'healHero': {
      const side = step.side === 'enemy' ? opponentSide : casterSide;
      const p = game[side];
      p.heroHp = Math.min(p.heroMaxHp, p.heroHp + step.value);
      game.log.push({ text: `${sideName(side)} 恢复 ${step.value} 点生命`, cls: 'good' });
      break;
    }
    case 'damageHero': {
      const side = step.side === 'enemy' ? opponentSide : casterSide;
      game[side].heroHp -= step.value;
      game.log.push({ text: `${sideName(side)} 受到 ${step.value} 点伤害`, cls: 'bad' });
      checkWin(game);
      break;
    }
    case 'drawCards': {
      const side = step.side === 'enemy' ? opponentSide : casterSide;
      for (let i = 0; i < step.value; i++) drawCard(game, side);
      break;
    }
    case 'buffMinionTemp': {
      const ref = findMinion(game, targetUid);
      if (ref) {
        ref.minion.attack += step.atk;
        ref.minion.health += step.hp;
        ref.minion.maxHealth += step.hp;
        ref.minion.tempBuff = ref.minion.tempBuff
          ? { atk: ref.minion.tempBuff.atk + step.atk, hp: ref.minion.tempBuff.hp + step.hp }
          : { atk: step.atk, hp: step.hp };
        game.log.push({ text: `${ref.minion.name} 获得 +${step.atk}/+${step.hp}（回合结束消失）`, cls: 'good' });
      }
      break;
    }
    case 'damageMinionThenBuffRandomIfDied': {
      const ref = findMinion(game, targetUid);
      if (ref) {
        const died = dealDamageToMinion(game, ref, step.value);
        if (died) {
          const friendly = game[casterSide].board;
          if (friendly.length > 0) {
            const pick = friendly[Math.floor(Math.random() * friendly.length)];
            pick.attack += step.atk;
            pick.health += step.hp;
            pick.maxHealth += step.hp;
            pick.tempBuff = pick.tempBuff
              ? { atk: pick.tempBuff.atk + step.atk, hp: pick.tempBuff.hp + step.hp }
              : { atk: step.atk, hp: step.hp };
            game.log.push({ text: `${pick.name} 获得 +${step.atk}/+${step.hp}（回合结束消失）`, cls: 'good' });
          }
        }
      }
      break;
    }
    case 'damageMinionThenDrawIfDied': {
      const ref = findMinion(game, targetUid);
      if (ref) {
        const died = dealDamageToMinion(game, ref, step.value);
        if (died) for (let i = 0; i < step.draw; i++) drawCard(game, casterSide);
      }
      break;
    }
    case 'summonMinion': {
      const side = step.side === 'enemy' ? opponentSide : casterSide;
      const p = game[side];
      if (p.board.length < BOARD_LIMIT) {
        p.board.push({
          uid: uid('m'), cardId: null, name: step.name,
          attack: step.attack, health: step.health, maxHealth: step.health,
          canAttack: false, tempBuff: null,
        });
        game.log.push({ text: `${sideName(side)} 召唤了 ${step.name}`, cls: 'good' });
      }
      break;
    }
    default:
      console.warn('Unknown effect step', step);
  }
}

function resolveEffect(game, effect, casterSide, targetUid) {
  const steps = effect.type === 'composite' ? effect.steps : [effect];
  steps.forEach(s => resolveStep(game, s, casterSide, targetUid));
}

/** Returns null on success, or an error message string. */
export function playCard(game, side, handIndex, targetUid) {
  if (game.over) return '对局已结束';
  if (game.active !== side) return '还没轮到你';
  const p = game[side];
  const entry = p.hand[handIndex];
  if (!entry) return '没有这张牌';
  const card = getCard(entry.cardId);
  if (p.manaCur < card.cost) return '法力不足';

  if (card.type === 'minion') {
    if (p.board.length >= BOARD_LIMIT) return '场上随从已满';
    if (requiresMinionTarget(card) && !targetUid) return '这张牌需要选择一个目标';
    p.manaCur -= card.cost;
    p.hand.splice(handIndex, 1);
    p.board.push({
      uid: uid('m'), cardId: card.id, name: card.name,
      attack: card.attack, health: card.health, maxHealth: card.health,
      canAttack: false, tempBuff: null,
    });
    game.log.push({ text: `${sideName(side)} 打出 ${card.name}`, cls: 'info' });
    if (card.effect) resolveEffect(game, card.effect, side, targetUid); // battlecry
    checkWin(game);
    return null;
  }

  // spell (legacy path, kept in case a pure spell is added again)
  if (requiresMinionTarget(card) && !targetUid) return '这张牌需要选择一个目标';
  p.manaCur -= card.cost;
  p.hand.splice(handIndex, 1);
  game.log.push({ text: `${sideName(side)} 施放 ${card.name}`, cls: 'info' });
  resolveEffect(game, card.effect, side, targetUid);
  checkWin(game);
  return null;
}

/** Returns null on success, or an error message string. */
export function attack(game, side, attackerUid, targetUid) {
  if (game.over) return '对局已结束';
  if (game.active !== side) return '还没轮到你';
  const attackerRef = game[side].board.find(m => m.uid === attackerUid);
  if (!attackerRef) return '找不到攻击者';
  if (!attackerRef.canAttack) return '这个随从本回合不能攻击';

  const opponentSide = otherSide(side);
  if (targetUid === 'hero') {
    game[opponentSide].heroHp -= attackerRef.attack;
    game.log.push({ text: `${attackerRef.name} 对 ${sideName(opponentSide)} 造成 ${attackerRef.attack} 点伤害`, cls: 'bad' });
    attackerRef.canAttack = false;
    checkWin(game);
    return null;
  }

  const defenderRef = game[opponentSide].board.find(m => m.uid === targetUid);
  if (!defenderRef) return '找不到目标';
  defenderRef.health -= attackerRef.attack;
  attackerRef.health -= defenderRef.attack;
  game.log.push({ text: `${attackerRef.name} 与 ${defenderRef.name} 交战`, cls: 'info' });
  attackerRef.canAttack = false;
  game[opponentSide].board = game[opponentSide].board.filter(m => m.health > 0);
  game[side].board = game[side].board.filter(m => m.health > 0);
  return null;
}

// ─── Very small greedy AI ───

/** Picks a reasonable target uid for a card's battlecry, or null if no
 * target is needed, or undefined if a target is needed but none exists. */
function pickAiTarget(game, card, casterSide) {
  if (!requiresMinionTarget(card)) return null;
  const steps = card.effect.type === 'composite' ? card.effect.steps : [card.effect];
  const step = steps.find(s => ['damageMinion', 'buffMinionTemp', 'damageMinionThenBuffRandomIfDied', 'damageMinionThenDrawIfDied'].includes(s.type));
  const opponentSide = otherSide(casterSide);
  const pool = step.side === 'friendly' ? game[casterSide].board : game[opponentSide].board;
  if (pool.length === 0) return undefined;
  if (step.side === 'friendly') {
    // Buff: favor our own strongest attacker.
    return pool.reduce((best, m) => (!best || m.attack > best.attack) ? m : best, null).uid;
  }
  // Damage: favor whatever the hit is most likely to kill.
  return pool.reduce((best, m) => (!best || m.health < best.health) ? m : best, null).uid;
}

export function runAiTurn(game) {
  const ai = game.ai;
  // Play the biggest affordable minion repeatedly.
  let playedSomething = true;
  while (playedSomething && !game.over) {
    playedSomething = false;
    const options = ai.hand
      .map((h, idx) => ({ idx, card: getCard(h.cardId) }))
      .filter(o => o.card.cost <= ai.manaCur && ai.board.length < BOARD_LIMIT)
      .sort((a, b) => b.card.cost - a.card.cost);
    for (const opt of options) {
      const targetUid = pickAiTarget(game, opt.card, 'ai');
      if (targetUid === undefined) continue; // needs a target but none available
      const err = playCard(game, 'ai', opt.idx, targetUid);
      if (!err) { playedSomething = true; break; }
    }
  }
  // Attack with everything that can attack, always going face.
  ai.board.filter(m => m.canAttack).forEach(m => {
    if (!game.over) attack(game, 'ai', m.uid, 'hero');
  });
  // Hand control back to the player once the AI is done.
  if (!game.over) endTurn(game);
}
