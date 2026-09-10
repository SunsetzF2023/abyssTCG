// ============================================================
// Autobattler piece database — AbyssTCG
//
// Each piece is a battle unit bought from the shop. Pieces have:
//   id        — unique identifier
//   name      — display name
//   tier      — shop cost tier 1..5 (also drop rarity weight)
//   race      — one of: human / orc / undead / demon / beast
//   attack    — base attack at star 1
//   health    — base health at star 1
//   ability   — optional battle ability descriptor (see engine)
//
// Star upgrade: 3 copies of star N merge into 1 of star N+1.
//   star 2 = 2x stats, star 3 = 3x stats (multiplicative on base).
// ============================================================

export const RACES = ['human', 'orc', 'undead', 'demon', 'beast'];

export const RACE_INFO = {
  human:   { name: '人类',   icon: '⚔️', color: '#5b8def' },
  orc:     { name: '兽人',   icon: '🪓', color: '#e0574a' },
  undead:  { name: '亡灵',   icon: '💀', color: '#9b6bd6' },
  demon:   { name: '恶魔',   icon: '👿', color: '#8e1f3b' },
  beast:   { name: '野兽',   icon: '🐺', color: '#5a9e5a' },
};

// Ability types interpreted by the battle engine:
//   taunt        — enemies must target this minion first while it's alive
//   deathrattle  — triggers when this minion dies
//     subtypes: 'summon' (summon N tokens), 'damageRandomEnemy' (deal X to a
//               random enemy minion), 'buffAllies' (give all friendly minions +X/+Y)
//   battlecry    — triggers when this minion enters play (not used in pure
//                  autobattler combat, but kept for future shop-phase effects)
//   enrage       — passive: while below 50% hp, gains +X attack
//   cleave       — attack also hits adjacent enemies
//   lifesteal    — heals own hero for X% of damage dealt (hero not modeled
//                  in autobattler; instead heals self for X% of damage dealt)
//   divineShield — absorbs one hit (consumed on first damage instance)
//   poison       — any damage dealt is lethal (target dies regardless of hp)
//
// For Phase 1 we implement: taunt, deathrattle (all subtypes), enrage,
// cleave, divineShield, poison. (battlecry/lifesteal deferred.)

export const PIECES = [
  // ─── Tier 1 (cost 1) ──────────────────────────────────────────
  {
    id: 't1_recruit', name: '见习卫兵', tier: 1, race: 'human',
    attack: 2, health: 3,
    ability: { type: 'taunt' },
  },
  {
    id: 't1_grunt', name: '狂暴新兵', tier: 1, race: 'orc',
    attack: 3, health: 2,
    ability: { type: 'enrage', atk: 2 },
  },
  {
    id: 't1_thrall', name: '腐化侍从', tier: 1, race: 'undead',
    attack: 1, health: 2,
    ability: { type: 'deathrattle', subtype: 'summon', count: 1, token: 't1_thrall_token' },
  },
  {
    id: 't1_imp', name: '深渊爪牙', tier: 1, race: 'demon',
    attack: 3, health: 1,
  },
  {
    id: 't1_wolfpup', name: '幼狼', tier: 1, race: 'beast',
    attack: 2, health: 2,
    ability: { type: 'deathrattle', subtype: 'buffAllies', atk: 1, hp: 0 },
  },

  // ─── Tier 2 (cost 2) ──────────────────────────────────────────
  {
    id: 't2_pikeman', name: '长枪卫士', tier: 2, race: 'human',
    attack: 3, health: 4,
    ability: { type: 'taunt' },
  },
  {
    id: 't2_axeman', name: '嗜血斧手', tier: 2, race: 'orc',
    attack: 4, health: 3,
    ability: { type: 'cleave' },
  },
  {
    id: 't2_bonewarden', name: '骸骨卫兵', tier: 2, race: 'undead',
    attack: 2, health: 4,
    ability: { type: 'deathrattle', subtype: 'damageRandomEnemy', value: 2 },
  },
  {
    id: 't2_pact_demon', name: '契约恶魔', tier: 2, race: 'demon',
    attack: 4, health: 3,
    ability: { type: 'divineShield' },
  },
  {
    id: 't2_boar', name: '荆棘野猪', tier: 2, race: 'beast',
    attack: 3, health: 3,
    ability: { type: 'poison' },
  },

  // ─── Tier 3 (cost 3) ──────────────────────────────────────────
  {
    id: 't3_templar', name: '圣殿骑士', tier: 3, race: 'human',
    attack: 4, health: 5,
    ability: { type: 'taunt' },
  },
  {
    id: 't3_butcher', name: '部落屠夫', tier: 3, race: 'orc',
    attack: 5, health: 4,
    ability: { type: 'enrage', atk: 3 },
  },
  {
    id: 't3_crypt_stalker', name: '墓穴潜行者', tier: 3, race: 'undead',
    attack: 4, health: 4,
    ability: { type: 'deathrattle', subtype: 'summon', count: 2, token: 't1_thrall_token' },
  },
  {
    id: 't3_hellfire_fiend', name: '炽炎恐魔', tier: 3, race: 'demon',
    attack: 5, health: 5,
    ability: { type: 'cleave' },
  },
  {
    id: 't3_tiger', name: '迅猎猛虎', tier: 3, race: 'beast',
    attack: 6, health: 4,
    ability: { type: 'poison' },
  },

  // ─── Tier 4 (cost 4) ──────────────────────────────────────────
  {
    id: 't4_marshal', name: '王国统帅', tier: 4, race: 'human',
    attack: 5, health: 6,
    ability: { type: 'taunt' },
  },
  {
    id: 't4_warlord', name: '怒吼督军', tier: 4, race: 'orc',
    attack: 6, health: 5,
    ability: { type: 'enrage', atk: 4 },
  },
  {
    id: 't4_bonelord', name: '枯骨领主', tier: 4, race: 'undead',
    attack: 5, health: 5,
    ability: { type: 'deathrattle', subtype: 'buffAllies', atk: 2, hp: 2 },
  },
  {
    id: 't4_abyss_lord', name: '深渊领主', tier: 4, race: 'demon',
    attack: 7, health: 7,
    ability: { type: 'divineShield' },
  },
  {
    id: 't4_totem_bear', name: '图腾巨熊', tier: 4, race: 'beast',
    attack: 5, health: 7,
    ability: { type: 'taunt' },
  },

  // ─── Tier 5 (cost 5) ──────────────────────────────────────────
  {
    id: 't5_paladin', name: '光辉近卫', tier: 5, race: 'human',
    attack: 7, health: 8,
    ability: { type: 'taunt' },
  },
  {
    id: 't5_godslayer', name: '血怒战神', tier: 5, race: 'orc',
    attack: 8, health: 7,
    ability: { type: 'enrage', atk: 5 },
  },
  {
    id: 't5_abyss_wraith', name: '深渊亡魂', tier: 5, race: 'undead',
    attack: 6, health: 6,
    ability: { type: 'deathrattle', subtype: 'summon', count: 3, token: 't1_thrall_token' },
  },
  {
    id: 't5_ravager', name: '毁灭使者', tier: 5, race: 'demon',
    attack: 9, health: 8,
    ability: { type: 'cleave' },
  },
  {
    id: 't5_ancient_beast', name: '远古巨兽', tier: 5, race: 'beast',
    attack: 8, health: 8,
    ability: { type: 'poison' },
  },
];

// Token piece summoned by deathrattles (1/1 vanilla).
export const TOKEN_PIECES = {
  t1_thrall_token: {
    id: 't1_thrall_token', name: '腐化残骸', tier: 1, race: 'undead',
    attack: 1, health: 1,
    isToken: true,
  },
};

export function getPiece(id) {
  if (TOKEN_PIECES[id]) return TOKEN_PIECES[id];
  return PIECES.find((p) => p.id === id);
}

export function piecesByTier(tier) {
  return PIECES.filter((p) => p.tier === tier);
}

/** Drop pool weights — higher tier = rarer. */
export const TIER_WEIGHTS = { 1: 70, 2: 30, 3: 15, 4: 6, 5: 2 };
