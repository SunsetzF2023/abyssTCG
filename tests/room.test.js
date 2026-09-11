import { describe, it, expect } from 'vitest';
import {
  createRoom,
  SLOT_TYPE,
  ROOM_STATE,
  isHost,
  addAISlot,
  addPlayerSlot,
  removeSlot,
  fillWithAI,
  canStartGame,
  startGame,
  getFirstEmptySlotIndex,
} from '../src/autobattler/room.js';

describe('room system', () => {
  it('creates a room with host in slot 0 and 7 empty slots', () => {
    const room = createRoom('Alice');
    expect(room.state).toBe(ROOM_STATE.LOBBY);
    expect(room.slots.length).toBe(8);
    expect(room.slots[0].type).toBe(SLOT_TYPE.PLAYER);
    expect(room.slots[0].name).toBe('Alice');
    expect(room.slots.slice(1).every((s) => s.type === SLOT_TYPE.EMPTY)).toBe(true);
  });

  it('only the host is recognized as host', () => {
    const room = createRoom('Alice');
    expect(isHost(room, 'Alice')).toBe(true);
    expect(isHost(room, 'Bob')).toBe(false);
  });

  it('adds AI to the first empty slot', () => {
    const room = createRoom('Alice');
    const idx = getFirstEmptySlotIndex(room);
    expect(idx).toBe(1);
    expect(addAISlot(room, idx)).toBe(true);
    expect(room.slots[idx].type).toBe(SLOT_TYPE.AI);
    expect(room.slots[idx].name).toMatch(/挑战者_/);
  });

  it('prevents adding to occupied slots', () => {
    const room = createRoom('Alice');
    expect(addAISlot(room, 0)).toBe(false);
    expect(addPlayerSlot(room, 0, 'Bob')).toBe(false);
  });

  it('removes an AI slot', () => {
    const room = createRoom('Alice');
    addAISlot(room, 1);
    expect(removeSlot(room, 1)).toBe(true);
    expect(room.slots[1].type).toBe(SLOT_TYPE.EMPTY);
    expect(removeSlot(room, 1)).toBe(false);
  });

  it('fills all empty slots with AI', () => {
    const room = createRoom('Alice');
    const added = fillWithAI(room);
    expect(added).toBe(7);
    expect(room.slots.every((s) => s.type !== SLOT_TYPE.EMPTY)).toBe(true);
    expect(canStartGame(room)).toBe(true);
  });

  it('cannot start game until all slots are filled', () => {
    const room = createRoom('Alice');
    expect(canStartGame(room)).toBe(false);
    addAISlot(room, 1);
    expect(canStartGame(room)).toBe(false);
  });

  it('starts the game only when full', () => {
    const room = createRoom('Alice');
    fillWithAI(room);
    startGame(room);
    expect(room.state).toBe(ROOM_STATE.GAME);
  });
});
