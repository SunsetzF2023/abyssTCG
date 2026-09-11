// ============================================================
// Battle animator — AbyssTCG autobattler
//
// Plays the resolved battle log as a real-time animation:
//   - attacker/target flashes
//   - beam / ray effect between attacker and target
//   - floating damage numbers
//   - heal / buff / debuff numbers
//   - summon / death fade effects
//   - health-bar updates
// ============================================================

import { RACE_INFO } from './pieces.js';

const EVENT_DELAY_MS = 500;
let HUMAN_SIDE = 'attacker';

function otherSide(side) { return side === 'attacker' ? 'defender' : 'attacker'; }

export function setHumanSide(side) {
  HUMAN_SIDE = side;
}

export function createCombatCard(m, side) {
  const race = RACE_INFO[m.race] || { icon: '', color: '#888' };
  const stars = '⭐'.repeat(m.star);
  const hpPercent = Math.max(0, Math.min(100, (m.health / m.maxHealth) * 100));
  return `
    <div class="ab-minion ab-combat-minion" data-uid="${m.uid}" data-side="${side}" data-pos="${m.pos}"
         data-max-hp="${m.maxHealth}" data-hp="${m.health}"
         style="border-color:${race.color}">
      <div class="ab-hp-bar"><div class="ab-hp-fill" style="width:${hpPercent}%"></div></div>
      <div class="ab-minion-stars">${stars}</div>
      <div class="ab-minion-icon">${race.icon}</div>
      <div class="ab-minion-name">${m.name}</div>
      <div class="ab-minion-stats">
        <span class="atk">⚔️${m.attack}</span>
        <span class="hp">❤️${m.health}</span>
      </div>
      ${m.shield ? '<div class="ab-shield">🛡️</div>' : ''}
    </div>
  `;
}

function getSlotId(side, pos) {
  const isPlayer = side === HUMAN_SIDE;
  const row = pos < 3 ? 'front' : 'back';
  return isPlayer ? `ab-player-${row}` : `ab-enemy-${row}`;
}

function renderBoardRowTo(container, board, side, start, end) {
  container.innerHTML = '';
  for (let i = start; i < end; i++) {
    const m = board[i];
    const slot = document.createElement('div');
    slot.className = 'ab-board-slot';
    slot.dataset.pos = i;
    slot.dataset.side = side;
    if (m) {
      m.pos = i;
      slot.innerHTML = createCombatCard(m, side);
    }
    container.appendChild(slot);
  }
}

export function renderInitialBoards(initialBoards) {
  const human = HUMAN_SIDE === 'attacker' ? initialBoards.attacker : initialBoards.defender;
  const enemy = HUMAN_SIDE === 'attacker' ? initialBoards.defender : initialBoards.attacker;
  renderBoardRowTo(document.getElementById('ab-enemy-front'), enemy, otherSide(HUMAN_SIDE), 0, 3);
  renderBoardRowTo(document.getElementById('ab-enemy-back'), enemy, otherSide(HUMAN_SIDE), 3, 6);
  renderBoardRowTo(document.getElementById('ab-player-front'), human, HUMAN_SIDE, 0, 3);
  renderBoardRowTo(document.getElementById('ab-player-back'), human, HUMAN_SIDE, 3, 6);
}

function getCard(side, uid) {
  return document.querySelector(`.ab-combat-minion[data-side="${side}"][data-uid="${uid}"]`);
}

function updateStats(card, { attack, health, maxHealth } = {}) {
  if (!card) return;
  if (maxHealth !== undefined) card.dataset.maxHp = maxHealth;
  if (attack !== undefined) {
    const atkEl = card.querySelector('.ab-minion-stats .atk');
    if (atkEl) atkEl.textContent = `⚔️${attack}`;
  }
  if (health !== undefined) {
    const maxHp = parseInt(card.dataset.maxHp, 10);
    health = Math.max(0, Math.min(health, maxHp));
    card.dataset.hp = health;
    const fill = card.querySelector('.ab-hp-fill');
    if (fill) fill.style.width = `${(health / maxHp) * 100}%`;
    const hpEl = card.querySelector('.ab-minion-stats .hp');
    if (hpEl) hpEl.textContent = `❤️${health}`;
    if (health <= 0) markDead(card);
  }
}

function updateHp(card, newHp) { updateStats(card, { health: newHp }); }

function cardCenter(card) {
  const rect = card.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function showFloatingText(card, text, colorClass = '') {
  if (!card) return;
  const center = cardCenter(card);
  const el = document.createElement('div');
  el.className = `ab-float-text ${colorClass}`;
  el.textContent = text;
  el.style.left = `${center.x}px`;
  el.style.top = `${center.y - 20}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function flashCard(card, flashClass, duration = 250) {
  if (!card) return;
  card.classList.add(flashClass);
  setTimeout(() => card.classList.remove(flashClass), duration);
}

function lungeCard(card) {
  if (!card) return;
  card.classList.add('ab-lunge');
  setTimeout(() => card.classList.remove('ab-lunge'), 250);
}

function leapCard(attacker, target) {
  if (!attacker || !target) return;
  const r1 = attacker.getBoundingClientRect();
  const r2 = target.getBoundingClientRect();
  const clone = attacker.cloneNode(true);
  clone.classList.add('ab-leap-clone', 'ab-combat-minion');
  clone.style.position = 'fixed';
  clone.style.left = `${r1.left}px`;
  clone.style.top = `${r1.top}px`;
  clone.style.width = `${r1.width}px`;
  clone.style.height = `${r1.height}px`;
  clone.style.margin = '0';
  document.body.appendChild(clone);

  const dx = r2.left + r2.width / 2 - (r1.left + r1.width / 2);
  const dy = r2.top + r2.height / 2 - (r1.top + r1.height / 2);
  const anim = clone.animate([
    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) scale(1.15) rotate(6deg)`, opacity: 1, offset: 0.45 },
    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
  ], { duration: 320, easing: 'ease-in-out' });
  anim.onfinish = () => clone.remove();
}

function createShards(card) {
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const shardCount = 10;
  for (let i = 0; i < shardCount; i++) {
    const shard = document.createElement('div');
    shard.className = 'ab-shard';
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 50;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    const rot = Math.random() * 360;
    shard.style.left = `${cx}px`;
    shard.style.top = `${cy}px`;
    shard.style.setProperty('--tx', `${tx}px`);
    shard.style.setProperty('--ty', `${ty}px`);
    shard.style.setProperty('--rot', `${rot}deg`);
    document.body.appendChild(shard);
    setTimeout(() => shard.remove(), 700);
  }
}

function markDead(card) {
  if (!card || card.classList.contains('ab-dead')) return;
  card.classList.add('ab-dead');
  updateHp(card, 0);
  createShards(card);
}

function showSummoned(ev) {
  const side = ev.side;
  const pos = ev.targetPos;
  const m = {
    uid: ev.targetUid,
    name: ev.targetName,
    race: ev.race,
    star: ev.star,
    attack: ev.attack,
    health: ev.health,
    maxHealth: ev.maxHealth,
    shield: ev.shield,
    pos,
  };
  const container = document.getElementById(getSlotId(side, pos));
  const slot = container.children[pos % 3];
  if (!slot) return;
  slot.innerHTML = createCombatCard(m, side);
  const card = slot.querySelector('.ab-combat-minion');
  if (card) {
    card.classList.add('ab-summon-in');
    setTimeout(() => card.classList.remove('ab-summon-in'), 500);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playAttackEvent(ev) {
  const attacker = getCard(ev.side, ev.attackerUid);
  const target = getCard(otherSide(ev.side), ev.targetUid);

  if (attacker && target) {
    leapCard(attacker, target);
  } else if (attacker) {
    lungeCard(attacker);
  }
  await sleep(160);

  if (target) {
    flashCard(target, 'ab-hit');
    showFloatingText(target, `-${ev.damage}`, 'ab-dmg');
    const newHp = parseInt(target.dataset.hp, 10) - ev.damage;
    updateHp(target, newHp);
  }
  await sleep(180);
}

async function playSplashEvent(ev) {
  const target = getCard(ev.side, ev.targetUid);
  if (target) {
    flashCard(target, 'ab-hit');
    showFloatingText(target, `-${ev.damage}`, 'ab-dmg');
    const newHp = parseInt(target.dataset.hp, 10) - ev.damage;
    updateHp(target, newHp);
    await sleep(300);
  }
}

async function playCounterEvent(ev) {
  const target = getCard(ev.side, ev.targetUid);
  if (target) {
    flashCard(target, 'ab-hit');
    showFloatingText(target, `-${ev.damage}`, 'ab-dmg');
    const newHp = parseInt(target.dataset.hp, 10) - ev.damage;
    updateHp(target, newHp);
    await sleep(300);
  }
}

async function playHealEvent(ev) {
  const target = getCard(ev.side, ev.targetUid);
  if (target) {
    flashCard(target, 'ab-heal-flash');
    showFloatingText(target, `+${ev.value}`, 'ab-heal');
    const newHp = parseInt(target.dataset.hp, 10) + ev.value;
    updateHp(target, newHp);
    await sleep(300);
  }
}

async function playBuffEvent(ev) {
  const target = getCard(ev.side, ev.targetUid);
  if (!target) return;

  const oldAtk = parseInt(target.querySelector('.ab-minion-stats .atk').textContent.replace('⚔️', ''), 10);
  const oldHp = parseInt(target.querySelector('.ab-minion-stats .hp').textContent.replace('❤️', ''), 10);
  const oldMaxHp = parseInt(target.dataset.maxHp, 10);

  const newAtk = oldAtk + (ev.atk || 0);
  const newHp = oldHp + (ev.hp || 0);
  const newMaxHp = oldMaxHp + (ev.hp || 0);

  const textParts = [];
  if (ev.atk) textParts.push(`${ev.atk > 0 ? '+' : ''}${ev.atk}⚔️`);
  if (ev.hp) textParts.push(`${ev.hp > 0 ? '+' : ''}${ev.hp}❤️`);
  if (textParts.length > 0) {
    showFloatingText(target, textParts.join(' '), 'ab-buff-gain');
  }

  updateStats(target, { attack: newAtk, health: newHp, maxHealth: newMaxHp });

  const atkEl = target.querySelector('.ab-minion-stats .atk');
  const hpEl = target.querySelector('.ab-minion-stats .hp');
  if (ev.atk) {
    atkEl.classList.add('ab-stat-buffed');
    setTimeout(() => atkEl.classList.remove('ab-stat-buffed'), 700);
  }
  if (ev.hp) {
    hpEl.classList.add('ab-stat-buffed');
    setTimeout(() => hpEl.classList.remove('ab-stat-buffed'), 700);
  }
  await sleep(300);
}

async function playDebuffEvent(ev) {
  const target = getCard(ev.side, ev.targetUid);
  if (!target) return;

  const oldAtk = parseInt(target.querySelector('.ab-minion-stats .atk').textContent.replace('⚔️', ''), 10);
  const oldHp = parseInt(target.querySelector('.ab-minion-stats .hp').textContent.replace('❤️', ''), 10);
  const oldMaxHp = parseInt(target.dataset.maxHp, 10);

  const newAtk = oldAtk + (ev.atk || 0);
  const newHp = oldHp + (ev.hp || 0);
  const newMaxHp = oldMaxHp + (ev.hp || 0);

  const textParts = [];
  if (ev.atk) textParts.push(`${ev.atk}⚔️`);
  if (ev.hp) textParts.push(`${ev.hp}❤️`);
  if (textParts.length > 0) {
    showFloatingText(target, textParts.join(' '), 'ab-debuff-lose');
  }

  updateStats(target, { attack: newAtk, health: newHp, maxHealth: newMaxHp });

  const atkEl = target.querySelector('.ab-minion-stats .atk');
  const hpEl = target.querySelector('.ab-minion-stats .hp');
  if (ev.atk) {
    atkEl.classList.add('ab-stat-debuffed');
    setTimeout(() => atkEl.classList.remove('ab-stat-debuffed'), 700);
  }
  if (ev.hp) {
    hpEl.classList.add('ab-stat-debuffed');
    setTimeout(() => hpEl.classList.remove('ab-stat-debuffed'), 700);
  }
  await sleep(300);
}

async function playFirstStrikeEvent(ev) {
  const card = getCard(ev.side, ev.sourceUid);
  if (card) flashCard(card, 'ab-lunge');
  await sleep(200);
}

async function playBattlecryEvent(ev) {
  const card = getCard(ev.side, ev.sourceUid);
  if (card) flashCard(card, 'ab-lunge');
  await sleep(200);
}

async function playSummonEvent(ev) {
  showSummoned(ev);
  await sleep(300);
}

async function playEvent(ev) {
  switch (ev.type) {
    case 'attack':
      await playAttackEvent(ev);
      break;
    case 'splash':
      await playSplashEvent(ev);
      break;
    case 'counter':
      await playCounterEvent(ev);
      break;
    case 'heal':
      await playHealEvent(ev);
      break;
    case 'buff':
      await playBuffEvent(ev);
      break;
    case 'debuff':
      await playDebuffEvent(ev);
      break;
    case 'firstStrike':
      await playFirstStrikeEvent(ev);
      break;
    case 'battlecry':
      await playBattlecryEvent(ev);
      break;
    case 'summon':
      await playSummonEvent(ev);
      break;
    default:
      await sleep(200);
  }
}

async function cleanupDeadFromLog(result) {
  // After all events, ensure all actually dead minions are marked dead visually
  result.attackerSurvivors.forEach((m) => {
    const card = getCard('attacker', m.uid);
    if (card) updateStats(card, { attack: m.attack, health: m.health, maxHealth: m.maxHealth });
  });
  result.defenderSurvivors.forEach((m) => {
    const card = getCard('defender', m.uid);
    if (card) updateStats(card, { attack: m.attack, health: m.health, maxHealth: m.maxHealth });
  });
  // Also remove cards that are not in survivors
  const aliveUids = (side) => {
    const list = side === 'attacker' ? result.attackerSurvivors : result.defenderSurvivors;
    return new Set(list.map((m) => m.uid));
  };
  ['attacker', 'defender'].forEach((side) => {
    const alive = aliveUids(side);
    document.querySelectorAll(`.ab-combat-minion[data-side="${side}"]`).forEach((card) => {
      if (!alive.has(card.dataset.uid)) markDead(card);
    });
  });
}

export async function playBattleAnimation(result, humanSide, onDone) {
  setHumanSide(humanSide);
  renderInitialBoards(result.initialBoards);
  await sleep(400); // let the board settle

  for (const ev of result.log) {
    await playEvent(ev);
    await sleep(EVENT_DELAY_MS);
  }

  await cleanupDeadFromLog(result);
  onDone();
}
