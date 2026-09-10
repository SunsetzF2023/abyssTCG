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
const BEAM_DURATION_MS = 350;

function otherSide(side) { return side === 'attacker' ? 'defender' : 'attacker'; }

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
  const isPlayer = side === 'attacker';
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
  renderBoardRowTo(document.getElementById('ab-enemy-front'), initialBoards.defender, 'defender', 0, 3);
  renderBoardRowTo(document.getElementById('ab-enemy-back'), initialBoards.defender, 'defender', 3, 6);
  renderBoardRowTo(document.getElementById('ab-player-front'), initialBoards.attacker, 'attacker', 0, 3);
  renderBoardRowTo(document.getElementById('ab-player-back'), initialBoards.attacker, 'attacker', 3, 6);
}

function getCard(side, uid) {
  return document.querySelector(`.ab-combat-minion[data-side="${side}"][data-uid="${uid}"]`);
}

function updateHp(card, newHp) {
  if (!card) return;
  const maxHp = parseInt(card.dataset.maxHp, 10);
  newHp = Math.max(0, Math.min(newHp, maxHp));
  card.dataset.hp = newHp;
  const fill = card.querySelector('.ab-hp-fill');
  if (fill) fill.style.width = `${(newHp / maxHp) * 100}%`;
  const hpStat = card.querySelector('.ab-minion-stats .hp');
  if (hpStat) hpStat.textContent = `❤️${newHp}`;
  if (newHp <= 0) markDead(card);
}

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

function fireBeam(fromCard, toCard, beamClass = '') {
  if (!fromCard || !toCard) return;
  const p1 = cardCenter(fromCard);
  const p2 = cardCenter(toCard);
  const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

  const beam = document.createElement('div');
  beam.className = `ab-beam ${beamClass}`;
  beam.style.width = `${length}px`;
  beam.style.left = `${p1.x}px`;
  beam.style.top = `${p1.y - 2}px`;
  beam.style.transform = `rotate(${angle}deg)`;
  document.body.appendChild(beam);
  setTimeout(() => beam.remove(), BEAM_DURATION_MS + 50);
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

  if (attacker) lungeCard(attacker);
  if (attacker && target) {
    const beamClass = ev.isPoison ? 'ab-poison-beam' : '';
    fireBeam(attacker, target, beamClass);
  }
  await sleep(150);

  if (target) {
    flashCard(target, 'ab-hit');
    showFloatingText(target, `-${ev.damage}`, 'ab-dmg');
    const newHp = parseInt(target.dataset.hp, 10) - ev.damage;
    updateHp(target, newHp);
  }
  await sleep(BEAM_DURATION_MS - 150);
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
  if (target) {
    showFloatingText(target, `+${ev.atk || 0}⚔️ +${ev.hp || 0}❤️`, 'ab-buff');
    await sleep(300);
  }
}

async function playDebuffEvent(ev) {
  const target = getCard(ev.side, ev.targetUid);
  if (target) {
    showFloatingText(target, `${ev.atk || 0}⚔️ ${ev.hp || 0}❤️`, 'ab-debuff');
    await sleep(300);
  }
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
    if (card) updateHp(card, m.health);
  });
  result.defenderSurvivors.forEach((m) => {
    const card = getCard('defender', m.uid);
    if (card) updateHp(card, m.health);
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

export async function playBattleAnimation(result, onDone) {
  renderInitialBoards(result.initialBoards);
  await sleep(400); // let the board settle

  for (const ev of result.log) {
    await playEvent(ev);
    await sleep(EVENT_DELAY_MS);
  }

  await cleanupDeadFromLog(result);
  onDone();
}
