// ============================================================
// Host-authoritative PVP game sync — AbyssTCG
//
// Uses one Broadcast channel for game_state (host -> clients) and
// a second channel for player_action (clients -> host). Keeping
// actions on their own channel guarantees the listener is added
// before the channel subscribes on the host.
// ============================================================

import { supabaseClient } from './supabase-config.js';

const gameChannels = new Map();
const actionChannels = new Map();

function getChannel(map, roomId, prefix) {
  let entry = map.get(roomId);
  if (!entry) {
    const channel = supabaseClient.channel(`${prefix}:${roomId}`, { config: { broadcast: { self: true } } });
    let resolve;
    let reject;
    const ready = new Promise((res, rej) => { resolve = res; reject = rej; });
    entry = { channel, ready, resolve, reject, subscribed: false };
    map.set(roomId, entry);
  }
  return entry;
}

function getGameChannel(roomId) { return getChannel(gameChannels, roomId, 'game'); }
function getActionChannel(roomId) { return getChannel(actionChannels, roomId, 'game-actions'); }

function ensureChannel(entry) {
  if (entry.subscribed) return entry.ready;
  entry.subscribed = true;
  entry.channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      entry.resolve(entry.channel);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      entry.reject(new Error(`Realtime channel ${status}`));
    }
  });
  return entry.ready;
}

function safeCloneGame(game) {
  try {
    const str = JSON.stringify(game);
    if (!str) return null;
    return JSON.parse(str);
  } catch (e) {
    console.error('[pvp] game state serialization failed:', e);
    return null;
  }
}

export function subscribeToGameState(roomId, onState) {
  const entry = getGameChannel(roomId);
  entry.channel.on('broadcast', { event: 'game_state' }, (payload) => {
    onState(payload.payload);
  });
  ensureChannel(entry);
  return () => {
    entry.channel.unsubscribe();
    gameChannels.delete(roomId);
  };
}

export function subscribeToGameActions(roomId, onAction) {
  const entry = getActionChannel(roomId);
  entry.channel.on('broadcast', { event: 'player_action' }, (payload) => {
    onAction(payload.payload);
  });
  const ready = ensureChannel(entry);
  const unsubscribe = () => {
    entry.channel.unsubscribe();
    actionChannels.delete(roomId);
  };
  unsubscribe.ready = ready;
  return unsubscribe;
}

export async function broadcastGameState(roomId, game) {
  const entry = getGameChannel(roomId);
  await ensureChannel(entry);
  const payload = safeCloneGame(game);
  if (!payload) return;
  await entry.channel.send({
    type: 'broadcast',
    event: 'game_state',
    payload,
  });
}

export async function sendPlayerAction(roomId, action) {
  const entry = getActionChannel(roomId);
  await ensureChannel(entry);
  console.log('[pvp] send action', action);
  await entry.channel.send({
    type: 'broadcast',
    event: 'player_action',
    payload: action,
  });
}
