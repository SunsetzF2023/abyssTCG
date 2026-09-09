// ============================================================
// Faction definitions — AbyssTCG
//
// Each faction is a self-contained "deck identity". MVP ships
// only the Human faction with real illustration assets; the
// other four ship with icon-only placeholder art until custom
// art is produced (see README "美术路线图").
// ============================================================

const FACTIONS = [
  {
    id: 'human',
    name: '人类 · 秩序军团',
    icon: '⚔️',
    color: '#5b8def',
    hasArt: true,
    blurb: '纪律严明的王国远征军，靠稳健的随从和精准的法术控制战场节奏。',
  },
  {
    id: 'orc',
    name: '兽人 · 血怒部落',
    icon: '🪓',
    color: '#e0574a',
    hasArt: false,
    blurb: '越战越强的狂暴战士，用高攻低血的随从和强化法术抢节奏。',
  },
  {
    id: 'undead',
    name: '亡灵 · 枯骨教团',
    icon: '💀',
    color: '#9b6bd6',
    hasArt: false,
    blurb: '靠抽卡与献祭周转资源的教团，擅长用小代价换取长线优势。',
  },
  {
    id: 'demon',
    name: '恶魔 · 深渊军团',
    icon: '👿',
    color: '#8e1f3b',
    hasArt: false,
    blurb: '以自身生命为代价换取压倒性场面优势的深渊契约者。',
  },
  {
    id: 'beast',
    name: '野兽 · 荒野图腾',
    icon: '🐺',
    color: '#5a9e5a',
    hasArt: false,
    blurb: '低费铺场、以数量和临时强化取胜的荒野部族。',
  },
];

function getFaction(id) {
  return FACTIONS.find(f => f.id === id);
}
