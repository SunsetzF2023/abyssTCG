// ============================================================
// Room / lobby system — AbyssTCG autobattler
//
// Local 8-slot room with human host and AI fillers.
// Mirrors the online room design doc but runs fully client-side.
// ============================================================

export const SLOT_TYPE = {
  EMPTY: 'empty',
  PLAYER: 'player',
  AI: 'ai',
};

export const ROOM_STATE = {
  LOBBY: 'lobby',
  GAME: 'game',
};

const AI_DIFFICULTY = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
};

const AI_PREFIXES = ['神秘', '暗影', '烈焰', '寒冰', '雷霆', '大地', '星辰', '虚空'];

export function createRoom(hostName = '你', hostNetworkId = null) {
  const slots = [];
  for (let i = 0; i < 8; i++) {
    slots.push({
      index: i,
      type: i === 0 ? SLOT_TYPE.PLAYER : SLOT_TYPE.EMPTY,
      name: i === 0 ? hostName : null,
      networkId: i === 0 ? hostNetworkId : null,
      aiDifficulty: null,
    });
  }
  return {
    state: ROOM_STATE.LOBBY,
    host: { name: hostName, networkId: hostNetworkId },
    slots,
  };
}

export function isHost(room, playerName) {
  return room.host.name === playerName;
}

export function getFirstEmptySlotIndex(room) {
  return room.slots.findIndex((s) => s.type === SLOT_TYPE.EMPTY);
}

export function addPlayerSlot(room, index, name, networkId = null) {
  if (index < 0 || index >= room.slots.length) return false;
  if (room.slots[index].type !== SLOT_TYPE.EMPTY) return false;
  room.slots[index] = {
    ...room.slots[index],
    type: SLOT_TYPE.PLAYER,
    name,
    networkId,
    aiDifficulty: null,
  };
  return true;
}

export function addAISlot(room, index, difficulty = AI_DIFFICULTY.MEDIUM) {
  if (index < 0 || index >= room.slots.length) return false;
  if (room.slots[index].type !== SLOT_TYPE.EMPTY) return false;
  const prefix = AI_PREFIXES[index % AI_PREFIXES.length];
  const suffix = 1000 + Math.floor(Math.random() * 9000);
  room.slots[index] = {
    ...room.slots[index],
    type: SLOT_TYPE.AI,
    name: `${prefix}挑战者_${suffix}`,
    networkId: null,
    aiDifficulty: difficulty,
  };
  return true;
}

export function removeSlot(room, index) {
  if (index < 0 || index >= room.slots.length) return false;
  if (room.slots[index].type === SLOT_TYPE.EMPTY) return false;
  room.slots[index] = {
    index,
    type: SLOT_TYPE.EMPTY,
    name: null,
    networkId: null,
    aiDifficulty: null,
  };
  return true;
}

export function fillWithAI(room) {
  let added = 0;
  for (const slot of room.slots) {
    if (slot.type === SLOT_TYPE.EMPTY) {
      if (addAISlot(room, slot.index)) added++;
    }
  }
  return added;
}

export function canStartGame(room) {
  return room.state === ROOM_STATE.LOBBY &&
    room.slots.every((s) => s.type !== SLOT_TYPE.EMPTY);
}

export function startGame(room) {
  room.state = ROOM_STATE.GAME;
}

export function getSlotLabel(slot) {
  if (slot.type === SLOT_TYPE.EMPTY) return '等待玩家加入...';
  if (slot.type === SLOT_TYPE.PLAYER) return slot.name || '玩家';
  if (slot.type === SLOT_TYPE.AI) return slot.name || 'AI';
  return '未知';
}
