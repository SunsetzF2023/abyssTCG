// ============================================================
// Host-authoritative PVP game sync — AbyssTCG
//
// Uses a single shared Supabase Broadcast channel per room so the
// host can push the full game state and clients can send actions.
// ============================================================

import { supabaseClient } from './supabase-config.js';

const channels = new Map(); // roomId -> { channel, ready, resolve, reject, subscribed }

function getChannelEntry(roomId) {
  let entry = channels.get(roomId);
  if (!entry) {
    const channel = supabaseClient.channel(`game:${roomId}`, { config: { broadcast: { self: true } } });
    let resolve;
    let reject;
    const ready = new Promise((res, rej) => { resolve = res; reject = rej; });
    entry = { channel, ready, resolve, reject, subscribed: false };
    channels.set(roomId, entry);
  }
  return entry;
}

function ensureSubscribed(roomId) {
  const entry = getChannelEntry(roomId);
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

export function subscribeToGameState(roomId, onState) {
  const entry = getChannelEntry(roomId);
  entry.channel.on('broadcast', { event: 'game_state' }, (payload) => {
    onState(payload.payload);
  });
  ensureSubscribed(roomId);
  return () => {
    entry.channel.unsubscribe();
    channels.delete(roomId);
  };
}

export function subscribeToGameActions(roomId, onAction) {
  const entry = getChannelEntry(roomId);
  entry.channel.on('broadcast', { event: 'player_action' }, (payload) => {
    onAction(payload.payload);
  });
  ensureSubscribed(roomId);
  return () => {
    entry.channel.unsubscribe();
    channels.delete(roomId);
  };
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

export async function broadcastGameState(roomId, game) {
  const entry = getChannelEntry(roomId);
  await ensureSubscribed(roomId);
  const payload = safeCloneGame(game);
  if (!payload) return;
  await entry.channel.send({
    type: 'broadcast',
    event: 'game_state',
    payload,
  });
}

export async function sendPlayerAction(roomId, action) {
  const entry = getChannelEntry(roomId);
  await ensureSubscribed(roomId);
  await entry.channel.send({
    type: 'broadcast',
    event: 'player_action',
    payload: action,
  });
}
