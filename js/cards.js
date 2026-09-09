// ============================================================
// Card database — AbyssTCG
//
// type: 'minion' (every card is a minion now)
// effect: optional battlecry — a small data-driven descriptor
//   interpreted by the engine (see js/engine.js -> resolveEffect).
//   Minions without `effect` are plain vanilla bodies; minions
//   with `effect` trigger it immediately when played, in addition
//   to entering play with their attack/health.
//
// art: 'human/xxx.png' for the few cards with real illustration
//   assets, otherwise omitted (UI falls back to the faction icon).
// ============================================================

const CARDS = [
  // ───────────────────────── 人类 · 秩序军团 ─────────────────────────
  { id: 'h_recruit', faction: 'human', type: 'minion', name: '见习卫兵', cost: 1, attack: 1, health: 3 },
  { id: 'h_pikeman', faction: 'human', type: 'minion', name: '长枪卫士', cost: 2, attack: 2, health: 3 },
  { id: 'h_templar', faction: 'human', type: 'minion', name: '圣殿骑士', cost: 3, attack: 3, health: 4 },
  { id: 'h_marshal', faction: 'human', type: 'minion', name: '王国统帅', cost: 4, attack: 4, health: 5 },
  { id: 'h_paladin', faction: 'human', type: 'minion', name: '光辉近卫', cost: 5, attack: 5, health: 6 },

  {
    id: 'h_strike', faction: 'human', type: 'minion', name: '钢铁一击', cost: 1, attack: 1, health: 2, art: 'human/strike.png',
    text: '战吼：对一个随从造成 3 点伤害。',
    effect: { type: 'damageMinion', value: 3 },
  },
  {
    id: 'h_defend', faction: 'human', type: 'minion', name: '沉稳盾墙', cost: 1, attack: 1, health: 2, art: 'human/defend.png',
    text: '战吼：使一个友方随从本回合获得 +0/+4。',
    effect: { type: 'buffMinionTemp', side: 'friendly', atk: 0, hp: 4 },
  },
  {
    id: 'h_heavy_slam', faction: 'human', type: 'minion', name: '破甲重锤', cost: 3, attack: 2, health: 4, art: 'human/heavy_slam.png',
    text: '战吼：对一个随从造成 6 点伤害。',
    effect: { type: 'damageMinion', value: 6 },
  },
  {
    id: 'h_purify', faction: 'human', type: 'minion', name: '圣光治愈', cost: 2, attack: 2, health: 3, art: 'human/purify.png',
    text: '战吼：恢复我方英雄 8 点生命。',
    effect: { type: 'healHero', side: 'friendly', value: 8 },
  },
  {
    id: 'h_cleave', faction: 'human', type: 'minion', name: '横扫千军', cost: 4, attack: 3, health: 5, art: 'human/cleave.png',
    text: '战吼：对所有敌方随从造成 4 点伤害。',
    effect: { type: 'damageAllMinions', side: 'enemy', value: 4 },
  },
  {
    id: 'h_offering', faction: 'human', type: 'minion', name: '热血献祭', cost: 1, attack: 1, health: 1, art: 'human/offering.png',
    text: '战吼：我方英雄失去 3 点生命，抽 2 张牌。',
    effect: { type: 'composite', steps: [
      { type: 'damageHero', side: 'friendly', value: 3 },
      { type: 'drawCards', side: 'friendly', value: 2 },
    ] },
  },
  {
    id: 'h_iron_wave', faction: 'human', type: 'minion', name: '铁浪突刺', cost: 2, attack: 2, health: 3, art: 'human/iron_wave.png',
    text: '战吼：对一个随从造成 4 点伤害，恢复我方英雄 4 点生命。',
    effect: { type: 'composite', steps: [
      { type: 'damageMinion', value: 4 },
      { type: 'healHero', side: 'friendly', value: 4 },
    ] },
  },
  {
    id: 'h_iron_arm', faction: 'human', type: 'minion', name: '铁壁之力', cost: 2, attack: 1, health: 3, art: 'human/iron_arm.png',
    text: '战吼：使一个友方随从本回合获得 +0/+6。',
    effect: { type: 'buffMinionTemp', side: 'friendly', atk: 0, hp: 6 },
  },

  // ───────────────────────── 兽人 · 血怒部落 ─────────────────────────
  { id: 'o_grunt', faction: 'orc', type: 'minion', name: '狂暴新兵', cost: 1, attack: 2, health: 1 },
  { id: 'o_axeman', faction: 'orc', type: 'minion', name: '嗜血斧手', cost: 2, attack: 3, health: 2 },
  { id: 'o_butcher', faction: 'orc', type: 'minion', name: '部落屠夫', cost: 3, attack: 4, health: 3 },
  { id: 'o_warlord', faction: 'orc', type: 'minion', name: '怒吼督军', cost: 4, attack: 5, health: 4 },
  { id: 'o_godslayer', faction: 'orc', type: 'minion', name: '血怒战神', cost: 6, attack: 7, health: 6 },

  {
    id: 'o_rage_strike', faction: 'orc', type: 'minion', name: '狂暴打击', cost: 2, attack: 2, health: 2,
    text: '战吼：对一个随从造成 5 点伤害。',
    effect: { type: 'damageMinion', value: 5 },
  },
  {
    id: 'o_bloodcurse', faction: 'orc', type: 'minion', name: '血怒诅咒', cost: 3, attack: 3, health: 3,
    text: '战吼：对一个随从造成 3 点伤害；若目标死亡，我方一个随机随从本回合获得 +2/+2。',
    effect: { type: 'damageMinionThenBuffRandomIfDied', value: 3, atk: 2, hp: 2 },
  },
  {
    id: 'o_warhorn', faction: 'orc', type: 'minion', name: '部落号角', cost: 1, attack: 1, health: 1,
    text: '战吼：使一个友方随从本回合获得 +2/+0。',
    effect: { type: 'buffMinionTemp', side: 'friendly', atk: 2, hp: 0 },
  },

  // ───────────────────────── 亡灵 · 枯骨教团 ─────────────────────────
  { id: 'u_thrall', faction: 'undead', type: 'minion', name: '腐化侍从', cost: 1, attack: 1, health: 1 },
  { id: 'u_bonewarden', faction: 'undead', type: 'minion', name: '骸骨卫兵', cost: 2, attack: 2, health: 3 },
  { id: 'u_crypt_stalker', faction: 'undead', type: 'minion', name: '墓穴潜行者', cost: 3, attack: 3, health: 3 },
  { id: 'u_bonelord', faction: 'undead', type: 'minion', name: '枯骨领主', cost: 4, attack: 4, health: 4 },
  { id: 'u_abyss_wraith', faction: 'undead', type: 'minion', name: '深渊亡魂', cost: 5, attack: 5, health: 5 },

  {
    id: 'u_soul_siphon', faction: 'undead', type: 'minion', name: '灵魂虹吸', cost: 1, attack: 1, health: 1,
    text: '战吼：对一个随从造成 2 点伤害，我方英雄恢复 2 点生命。',
    effect: { type: 'composite', steps: [
      { type: 'damageMinion', value: 2 },
      { type: 'healHero', side: 'friendly', value: 2 },
    ] },
  },
  {
    id: 'u_death_whisper', faction: 'undead', type: 'minion', name: '死亡低语', cost: 2, attack: 1, health: 3,
    text: '战吼：抽 2 张牌。',
    effect: { type: 'drawCards', side: 'friendly', value: 2 },
  },
  {
    id: 'u_corrosive_touch', faction: 'undead', type: 'minion', name: '腐蚀之触', cost: 3, attack: 2, health: 3,
    text: '战吼：对一个随从造成 4 点伤害；若目标死亡，抽 1 张牌。',
    effect: { type: 'damageMinionThenDrawIfDied', value: 4, draw: 1 },
  },

  // ───────────────────────── 恶魔 · 深渊军团 ─────────────────────────
  { id: 'd_imp', faction: 'demon', type: 'minion', name: '深渊爪牙', cost: 2, attack: 3, health: 2 },
  { id: 'd_pact_demon', faction: 'demon', type: 'minion', name: '契约恶魔', cost: 3, attack: 4, health: 2 },
  { id: 'd_hellfire_fiend', faction: 'demon', type: 'minion', name: '炽炎恐魔', cost: 5, attack: 6, health: 5 },
  { id: 'd_abyss_lord', faction: 'demon', type: 'minion', name: '深渊领主', cost: 6, attack: 7, health: 7 },
  { id: 'd_ravager', faction: 'demon', type: 'minion', name: '毁灭使者', cost: 7, attack: 9, health: 7 },

  {
    id: 'd_sacrificial_flame', faction: 'demon', type: 'minion', name: '献祭之焰', cost: 2, attack: 2, health: 2,
    text: '战吼：我方英雄失去 2 点生命，对一个随从造成 6 点伤害。',
    effect: { type: 'composite', steps: [
      { type: 'damageHero', side: 'friendly', value: 2 },
      { type: 'damageMinion', value: 6 },
    ] },
  },
  {
    id: 'd_abyssal_pact', faction: 'demon', type: 'minion', name: '深渊契约', cost: 3, attack: 2, health: 3,
    text: '战吼：抽 3 张牌，我方英雄失去 3 点生命。',
    effect: { type: 'composite', steps: [
      { type: 'drawCards', side: 'friendly', value: 3 },
      { type: 'damageHero', side: 'friendly', value: 3 },
    ] },
  },
  {
    id: 'd_firestorm', faction: 'demon', type: 'minion', name: '烈焰风暴', cost: 5, attack: 4, health: 5,
    text: '战吼：对所有敌方随从造成 5 点伤害。',
    effect: { type: 'damageAllMinions', side: 'enemy', value: 5 },
  },

  // ───────────────────────── 野兽 · 荒野图腾 ─────────────────────────
  { id: 'b_wolfpup', faction: 'beast', type: 'minion', name: '幼狼', cost: 1, attack: 1, health: 2 },
  { id: 'b_boar', faction: 'beast', type: 'minion', name: '荆棘野猪', cost: 2, attack: 2, health: 2 },
  { id: 'b_tiger', faction: 'beast', type: 'minion', name: '迅猎猛虎', cost: 3, attack: 4, health: 2 },
  { id: 'b_totem_bear', faction: 'beast', type: 'minion', name: '图腾巨熊', cost: 4, attack: 4, health: 6 },
  { id: 'b_ancient_beast', faction: 'beast', type: 'minion', name: '远古巨兽', cost: 6, attack: 8, health: 8 },

  {
    id: 'b_wild_call', faction: 'beast', type: 'minion', name: '野性呼唤', cost: 1, attack: 1, health: 1,
    text: '战吼：召唤一个 1/1 的野狼。',
    effect: { type: 'summonMinion', side: 'friendly', attack: 1, health: 1, name: '召唤 · 野狼' },
  },
  {
    id: 'b_fang_bite', faction: 'beast', type: 'minion', name: '尖牙撕咬', cost: 2, attack: 2, health: 2,
    text: '战吼：对一个随从造成 4 点伤害。',
    effect: { type: 'damageMinion', value: 4 },
  },
  {
    id: 'b_totem_ward', faction: 'beast', type: 'minion', name: '图腾庇护', cost: 3, attack: 2, health: 3,
    text: '战吼：使一个友方随从本回合获得 +3/+3。',
    effect: { type: 'buffMinionTemp', side: 'friendly', atk: 3, hp: 3 },
  },
];

function cardsForFaction(factionId) {
  return CARDS.filter(c => c.faction === factionId);
}

function getCard(id) {
  return CARDS.find(c => c.id === id);
}
