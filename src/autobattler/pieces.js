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
    ability: { type: 'firstStrike' },
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
    ability: { type: 'pierce' },
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
    ability: { type: 'cleave' },
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

export function describeAbility(ability) {
  if (!ability) return '无特殊技能。';
  switch (ability.type) {
    case 'taunt':
      return '嘲讽:优先成为敌方的攻击目标。';
    case 'shield':
      return '护盾:战斗开始时获得1层护盾,可抵挡1次伤害。';
    case 'cleave':
      return '顺劈:攻击时对目标及左右相邻单位造成伤害。';
    case 'pierce':
      return '贯穿:攻击时额外伤害目标后方的单位。';
    case 'enrage':
      return `激怒:生命值首次低于一半时,攻击+${ability.atk || 0}。`;
    case 'grow':
      return `成长:每个回合开始时攻击+${ability.atk || 0},生命+${ability.hp || 0}。`;
    case 'firstStrike':
      return '先手:战斗开始时先发动一次攻击。';
    case 'frenzy':
      return `连击:每个回合攻击 ${ability.count || 1} 次。`;
    case 'deathrattle':
      switch (ability.subtype) {
        case 'summon':
          return `亡语:死亡时召唤 ${ability.count || 1} 个 ${ability.token || '衍生物'}。`;
        case 'damageRandomEnemy':
          return `亡语:死亡时对一名随机敌方造成 ${ability.value || 0} 点伤害。`;
        case 'damageAllEnemies':
          return `亡语:死亡时对所有敌方造成 ${ability.value || 0} 点伤害。`;
        case 'buffAllies':
          return `亡语:死亡时使所有友方+${ability.atk || 0}攻击、+${ability.hp || 0}生命。`;
        case 'weakenAllEnemies':
          return `亡语:死亡时使所有敌方${ability.atk || 0}攻击、${ability.hp || 0}生命。`;
        default:
          return '亡语:死亡时触发特殊效果。';
      }
    case 'onKill':
      switch (ability.subtype) {
        case 'buffSelf':
          return `击杀:击杀敌人后自身+${ability.atk || 0}攻击、+${ability.hp || 0}生命。`;
        case 'gainGold':
          return '击杀:击杀敌人后自身+1/+1(战斗外金币收益不体现)。';
        case 'buffAllies':
          return `击杀:击杀敌人后所有友方+${ability.atk || 0}攻击、+${ability.hp || 0}生命。`;
        default:
          return '击杀:击杀敌人后触发效果。';
      }
    case 'meditate':
      switch (ability.subtype) {
        case 'healSelf':
          return `冥想:每个回合开始时恢复自身 ${ability.value || 0} 点生命。`;
        case 'healAdjacentAllies':
          return `冥想:每个回合开始时为相邻友方恢复 ${ability.value || 0} 点生命。`;
        case 'healAllAllies':
          return `冥想:每个回合开始时为所有友方恢复 ${ability.value || 0} 点生命。`;
        case 'damageRandomEnemy':
          return `冥想:每个回合开始时对一名随机敌方造成 ${ability.value || 0} 点伤害。`;
        case 'buffAllies':
          return `冥想:每个回合开始时使所有友方+${ability.atk || 0}攻击、+${ability.hp || 0}生命。`;
        default:
          return '冥想:每个回合开始时触发效果。';
      }
    case 'battlecry':
      switch (ability.subtype) {
        case 'buffRandomAlly':
          return `入场:使一名随机友方+${ability.atk || 0}攻击、+${ability.hp || 0}生命。`;
        case 'buffAdjacentAllies':
          return `入场:使相邻友方+${ability.atk || 0}攻击、+${ability.hp || 0}生命。`;
        case 'buffAlliesIfThree':
          return `入场:若友方数量≥3,使所有友方+${ability.atk || 0}攻击、+${ability.hp || 0}生命。`;
        default:
          return '入场:上阵时触发效果。';
      }
    default:
      return ability.type;
  }
}

const FLAVOR_TEMPLATES = [
  '{name}最大的梦想是升到六星。',
  '{name}最讨厌排队,但它很乐意插队到前排。',
  '{name}的座右铭:能动手就别吵吵。',
  '{name}曾是一名会计,后来转行了。',
  '{name}害怕孤独,所以总爱和队友贴贴。',
  '{name}宣称自己吃过龙,虽然没人信。',
  '{name}的弱点是甜食,但它从不吃亏。',
  '{name}总觉得自己才是主角。',
  '{name}的座右铭:少说话,多输出。',
  '{name}其实是个隐藏的美食家。',
  '{name}的梦想是退休开咖啡馆。',
  '{name}坚信颜值即战力。',
  '{name}曾经赢过一场棋局,那场棋局没有对手。',
  '{name}最怕下雨天,因为会生锈。',
  '{name}的口头禅:再升一星!',
  '{name}总把"世界和平"挂在嘴边。',
  '{name}最大的遗憾是没能长出更多牙齿。',
  '{name}最大的爱好是收集牙齿。',
  '{name}的梦想是成为卡牌原画。',
  '{name}一直觉得棋盘太小,施展不开。',
  '{name}曾是山林乐队的主唱。',
  '{name}相信明天会更好,除非遇到剧毒。',
  '{name}最讨厌别人说它小。',
  '{name}的梦想是开一家钢铁厂。',
  '{name}最喜欢的颜色是星空紫。',
  '{name}总怀疑敌人在作弊。',
  '{name}的愿望是世界和平与三星自己。',
  '{name}的座右铭:活着就是为了输出。',
  '{name}最大的爱好是晒太阳,可惜晒不到。',
  '{name}的梦想是成为传说。',
  '{name}经常说:"你打不到我~"',
  '{name}最讨厌被当作充电宝。',
  '{name}总觉得自己的模型应该更大。',
  '{name}的梦想是拥有一双翅膀。',
  '{name}最大的敌人是系统随机数。',
  '{name}的座右铭:越战越勇。',
  '{name}一直想学会隐身。',
  '{name}的梦想是成为阵容核心。',
  '{name}最享受的就是秒杀时刻。',
  '{name}最大的烦恼是名字太中二。',
  '{name}坚信自己是天选之子。',
  '{name}最想和设计师聊聊数值。',
  '{name}的口头禅:我三星啦!',
  '{name}的梦想是看到决赛圈。',
  '{name}最怕的就是天胡对手。',
  '{name}总觉得自己应该再多一个技能。',
  '{name}最大的爱好是看别人打架。',
  '{name}的座右铭:低调,但输出拉满。',
  '{name}一直想换个更酷炫的名字。',
  '{name}的梦想是被玩家选中。',
];

function flavorFor(piece) {
  const idx = piece.name.length % FLAVOR_TEMPLATES.length;
  return FLAVOR_TEMPLATES[idx].replace('{name}', piece.name);
}

// Enrich all pieces with generated description and flavor.
[...PIECES, ...Object.values(TOKEN_PIECES)].forEach((p) => {
  p.description = describeAbility(p.ability);
  p.flavor = flavorFor(p);
});

export function piecesByTier(tier) {
  return PIECES.filter((p) => p.tier === tier);
}

/** Drop pool weights — higher tier = rarer.
 *  With level 1 shop odds, max tier is 5 normally;
 *  tier 6 only appears at level 6. */
export const TIER_WEIGHTS = { 1: 60, 2: 30, 3: 15, 4: 6, 5: 2, 6: 0 };
