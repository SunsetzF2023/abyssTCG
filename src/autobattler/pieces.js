// ============================================================
// Autobattler piece database — AbyssTCG
//
// 48 original pieces across 6 tiers and 8 races.
// Inspired by autobattler mechanics but with original names
// and stats.
//
// Races:
//   neutral   中立 — flexible utility
//   ghost     幽灵 — ethereal / debuff / deathrattle
//   warrior   战士 — tanky / taunt / frontline
//   starborne 星裔 — magic / grow / auras
//   mech      机械 — shield / tokens / persistent
//   nature    自然 — heal / grow / regen
//   beast     野兽 — aggressive / on-kill / charge
//   dragon    龙   — powerful late-game / breath
//
// Star upgrade: 3 copies of star N -> 1 of star N+1 (max star 3).
// Star 2 = 2x base stats, star 3 = 3x base stats.
// ============================================================

export const RACES = ['neutral', 'ghost', 'warrior', 'starborne', 'mech', 'nature', 'beast', 'dragon'];

export const RACE_INFO = {
  neutral:   { name: '中立', icon: '💎', color: '#a0a0a0' },
  ghost:     { name: '幽灵', icon: '👻', color: '#9b6bd6' },
  warrior:   { name: '战士', icon: '🛡️', color: '#5b8def' },
  starborne: { name: '星裔', icon: '⭐', color: '#d6a0ff' },
  mech:      { name: '机械', icon: '⚙️', color: '#6a9e9e' },
  nature:    { name: '自然', icon: '🌿', color: '#5a9e5a' },
  beast:     { name: '野兽', icon: '🐾', color: '#e0a040' },
  dragon:    { name: '龙',   icon: '🐉', color: '#ff6a6a' },
};

// Ability types interpreted by the battle engine:
//   taunt        — enemies must target this minion first while it's alive
//   deathrattle  — triggers when this minion dies
//   battlecry    — triggers when this minion is placed (combat start)
//   grow         — at start of each combat round, gains +1/+1 (or more)
//   shield       — absorbs one hit, refreshes each combat round
//   cleave       — attack also hits adjacent enemies
//   pierce       — attack also hits the enemy directly behind the target
//   poison       — any damage dealt is lethal
//   enrage       — while below 50% hp, gains +X attack
//   firstStrike  — attacks once before normal combat starts
//   onKill       — triggers when this minion kills an enemy
//   frenzy       — attacks X times each round
//   meditate     — triggers at start of each combat round
//   attach       — when placed, attaches to an ally, giving it +X/+X and its ability

export const PIECES = [
  // ─── Tier 1 (cost 1) ──────────────────────────────────────────
  {
    id: 't1_wanderer', name: '流浪学徒', tier: 1, race: 'neutral',
    attack: 1, health: 2,
    ability: { type: 'battlecry', subtype: 'buffRandomAlly', atk: 2, hp: 1 },
  },
  {
    id: 't1_spectral_wisp', name: '幽光残影', tier: 1, race: 'ghost',
    attack: 2, health: 1,
    ability: { type: 'deathrattle', subtype: 'damageRandomEnemy', value: 2 },
  },
  {
    id: 't1_shieldbearer', name: '持盾少年', tier: 1, race: 'warrior',
    attack: 1, health: 4,
    ability: { type: 'taunt' },
  },
  {
    id: 't1_stardust', name: '星光微尘', tier: 1, race: 'starborne',
    attack: 1, health: 2,
    ability: { type: 'battlecry', subtype: 'buffAdjacentAllies', atk: 1, hp: 1 },
  },
  {
    id: 't1_gearling', name: '齿轮小工', tier: 1, race: 'mech',
    attack: 1, health: 2,
    ability: { type: 'deathrattle', subtype: 'summon', count: 1, token: 't1_spark_drone' },
  },
  {
    id: 't1_seedling', name: '萌芽', tier: 1, race: 'nature',
    attack: 1, health: 3,
    ability: { type: 'grow', atk: 1, hp: 1 },
  },
  {
    id: 't1_cub', name: '幼豹', tier: 1, race: 'beast',
    attack: 2, health: 1,
    ability: { type: 'onKill', subtype: 'buffSelf', atk: 1, hp: 1 },
  },
  {
    id: 't1_drakelet', name: '龙鳞幼崽', tier: 1, race: 'dragon',
    attack: 2, health: 2,
    ability: { type: 'shield' },
  },

  // ─── Tier 2 (cost 2) ──────────────────────────────────────────
  {
    id: 't2_hermit', name: '山中隐士', tier: 2, race: 'neutral',
    attack: 2, health: 3,
    ability: { type: 'meditate', subtype: 'healSelf', value: 2 },
  },
  {
    id: 't2_mourner', name: '哀悼者', tier: 2, race: 'ghost',
    attack: 3, health: 2,
    ability: { type: 'deathrattle', subtype: 'weakenAllEnemies', atk: -1, hp: 0 },
  },
  {
    id: 't2_pikeman', name: '方阵长枪', tier: 2, race: 'warrior',
    attack: 3, health: 4,
    ability: { type: 'taunt' },
  },
  {
    id: 't2_astromancer', name: '占星学徒', tier: 2, race: 'starborne',
    attack: 2, health: 3,
    ability: { type: 'grow', atk: 1, hp: 0 },
  },
  {
    id: 't2_junk_collector', name: '废铁回收工', tier: 2, race: 'mech',
    attack: 2, health: 3,
    ability: { type: 'deathrattle', subtype: 'summon', count: 2, token: 't1_spark_drone' },
  },
  {
    id: 't2_gardener', name: '花匠', tier: 2, race: 'nature',
    attack: 2, health: 3,
    ability: { type: 'meditate', subtype: 'healAdjacentAllies', value: 2 },
  },
  {
    id: 't2_hyena', name: '鬣狗', tier: 2, race: 'beast',
    attack: 3, health: 2,
    ability: { type: 'firstStrike' },
  },
  {
    id: 't2_whelp', name: '雏龙', tier: 2, race: 'dragon',
    attack: 3, health: 3,
    ability: { type: 'pierce' },
  },

  // ─── Tier 3 (cost 3) ──────────────────────────────────────────
  {
    id: 't3_gambler', name: '机遇赌徒', tier: 3, race: 'neutral',
    attack: 3, health: 3,
    ability: { type: 'battlecry', subtype: 'buffAlliesIfThree', atk: 2, hp: 2 },
  },
  {
    id: 't3_phantom', name: '幻影刺客', tier: 3, race: 'ghost',
    attack: 5, health: 2,
    ability: { type: 'poison' },
  },
  {
    id: 't3_sentinel', name: '重装哨卫', tier: 3, race: 'warrior',
    attack: 3, health: 6,
    ability: { type: 'taunt' },
  },
  {
    id: 't3_starcaller', name: '唤星者', tier: 3, race: 'starborne',
    attack: 2, health: 5,
    ability: { type: 'meditate', subtype: 'buffAllies', atk: 1, hp: 1 },
  },
  {
    id: 't3_turret', name: '自动炮台', tier: 3, race: 'mech',
    attack: 3, health: 3,
    ability: { type: 'firstStrike' },
  },
  {
    id: 't3_treant', name: '树人', tier: 3, race: 'nature',
    attack: 2, health: 6,
    ability: { type: 'grow', atk: 0, hp: 2 },
  },
  {
    id: 't3_lion', name: '狮王', tier: 3, race: 'beast',
    attack: 4, health: 4,
    ability: { type: 'onKill', subtype: 'healSelf', value: 3 },
  },
  {
    id: 't3_serpent', name: '双翼飞龙', tier: 3, race: 'dragon',
    attack: 4, health: 4,
    ability: { type: 'cleave' },
  },

  // ─── Tier 4 (cost 4) ──────────────────────────────────────────
  {
    id: 't4_mercenary', name: '流浪佣兵', tier: 4, race: 'neutral',
    attack: 5, health: 4,
    ability: { type: 'onKill', subtype: 'gainGold', value: 1 },
  },
  {
    id: 't4_wraith', name: '哀嚎女妖', tier: 4, race: 'ghost',
    attack: 4, health: 4,
    ability: { type: 'deathrattle', subtype: 'summon', count: 2, token: 't1_spectral_wisp' },
  },
  {
    id: 't4_champion', name: '冠军勇士', tier: 4, race: 'warrior',
    attack: 4, health: 6,
    ability: { type: 'enrage', atk: 3 },
  },
  {
    id: 't4_cosmos', name: '星域行者', tier: 4, race: 'starborne',
    attack: 3, health: 6,
    ability: { type: 'meditate', subtype: 'damageRandomEnemy', value: 3 },
  },
  {
    id: 't4_bulwark', name: '堡垒机甲', tier: 4, race: 'mech',
    attack: 4, health: 7,
    ability: { type: 'shield' },
  },
  {
    id: 't4_druid', name: '大德鲁伊', tier: 4, race: 'nature',
    attack: 3, health: 5,
    ability: { type: 'meditate', subtype: 'healAllAllies', value: 2 },
  },
  {
    id: 't4_pack_leader', name: '狼群首领', tier: 4, race: 'beast',
    attack: 5, health: 5,
    ability: { type: 'cleave' },
  },
  {
    id: 't4_wyvern', name: '毒刺飞龙', tier: 4, race: 'dragon',
    attack: 4, health: 5,
    ability: { type: 'poison' },
  },

  // ─── Tier 5 (cost 5) ──────────────────────────────────────────
  {
    id: 't5_adventurer', name: '深渊冒险家', tier: 5, race: 'neutral',
    attack: 5, health: 5,
    ability: { type: 'frenzy', count: 2 },
  },
  {
    id: 't5_banshee', name: '深渊哀嚎', tier: 5, race: 'ghost',
    attack: 6, health: 4,
    ability: { type: 'deathrattle', subtype: 'weakenAllEnemies', atk: -2, hp: -2 },
  },
  {
    id: 't5_paladin', name: '圣堂武士', tier: 5, race: 'warrior',
    attack: 5, health: 8,
    ability: { type: 'taunt' },
  },
  {
    id: 't5_stargazer', name: '观星长老', tier: 5, race: 'starborne',
    attack: 4, health: 7,
    ability: { type: 'meditate', subtype: 'buffAllies', atk: 2, hp: 1 },
  },
  {
    id: 't5_replicator', name: '自我复制机', tier: 5, race: 'mech',
    attack: 4, health: 6,
    ability: { type: 'deathrattle', subtype: 'summon', count: 1, token: 't5_replicator' },
  },
  {
    id: 't5_grove_guardian', name: '林地守护者', tier: 5, race: 'nature',
    attack: 5, health: 7,
    ability: { type: 'meditate', subtype: 'healAllAllies', value: 3 },
  },
  {
    id: 't5_alpha', name: '猛兽领主', tier: 5, race: 'beast',
    attack: 7, health: 6,
    ability: { type: 'onKill', subtype: 'buffAllies', atk: 1, hp: 1 },
  },
  {
    id: 't5_skydrake', name: '天空巨龙', tier: 5, race: 'dragon',
    attack: 6, health: 7,
    ability: { type: 'cleave' },
  },

  // ─── Tier 6 (cost 6) ──────────────────────────────────────────
  {
    id: 't6_miracle', name: '奇迹造物', tier: 6, race: 'neutral',
    attack: 6, health: 6,
    ability: { type: 'shield' },
  },
  {
    id: 't6_grim_reaper', name: '深渊收割者', tier: 6, race: 'ghost',
    attack: 8, health: 5,
    ability: { type: 'poison' },
  },
  {
    id: 't6_juggernaut', name: '无敌巨像', tier: 6, race: 'warrior',
    attack: 6, health: 10,
    ability: { type: 'taunt' },
  },
  {
    id: 't6_supernova', name: '超新星灵', tier: 6, race: 'starborne',
    attack: 7, health: 7,
    ability: { type: 'deathrattle', subtype: 'damageAllEnemies', value: 5 },
  },
  {
    id: 't6_colossus', name: '终极巨像', tier: 6, race: 'mech',
    attack: 8, health: 8,
    ability: { type: 'shield' },
  },
  {
    id: 't6_worldtree', name: '世界树灵', tier: 6, race: 'nature',
    attack: 5, health: 10,
    ability: { type: 'meditate', subtype: 'healAllAllies', value: 4 },
  },
  {
    id: 't6_behemoth', name: '远古巨兽', tier: 6, race: 'beast',
    attack: 9, health: 9,
    ability: { type: 'frenzy', count: 2 },
  },
  {
    id: 't6_leviathan', name: '深渊利维坦', tier: 6, race: 'dragon',
    attack: 8, health: 8,
    ability: { type: 'pierce' },
  },
];

// Token pieces summoned by abilities.
export const TOKEN_PIECES = {
  t1_spark_drone: {
    id: 't1_spark_drone', name: '火花无人机', tier: 1, race: 'mech',
    attack: 1, health: 1,
    isToken: true,
  },
  t1_spectral_wisp: {
    id: 't1_spectral_wisp', name: '残影', tier: 1, race: 'ghost',
    attack: 2, health: 1,
    isToken: true,
    ability: { type: 'deathrattle', subtype: 'damageRandomEnemy', value: 1 },
  },
};

export function getPiece(id) {
  if (TOKEN_PIECES[id]) return TOKEN_PIECES[id];
  return PIECES.find((p) => p.id === id);
}

export function piecesByTier(tier) {
  return PIECES.filter((p) => p.tier === tier);
}

/** Drop pool weights — higher tier = rarer.
 *  With level 1 shop odds, max tier is 5 normally;
 *  tier 6 only appears at level 6. */
export const TIER_WEIGHTS = { 1: 60, 2: 30, 3: 15, 4: 6, 5: 2, 6: 0 };
