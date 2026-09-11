// ============================================================
// Host-authoritative PVP game sync — AbyssTCG
//
// Uses Supabase Broadcast channels so the host can push the full
// game state to all clients, and clients can send their actions
// (buy, sell, move, ready) back to the host.
// ============================================================

import { supabaseClient } from './supabase-config.js';

export function makeGameChannel(roomId) {
  const channelName = `game:${roomId}`;
  return supabaseClient.channel(channelName, { configs: { broadcast: { self: true } } });
}

export function subscribeToGameState(roomId, onState) {
  const channel = makeGameChannel(roomId);

  channel
    .on('broadcast', { event: 'game_state' }, (payload) => {
      onState(payload.payload);
    })
    .subscribe();

  return () => channel.unsubscribe();
}

export function subscribeToGameActions(roomId, onAction) {
  const channel = makeGameChannel(roomId);

  channel
    .on('broadcast', { event: 'player_action' }, (payload) => {
      onAction(payload.payload);
    })
    .subscribe();

  return () => channel.unsubscribe();
}

export async function broadcastGameState(roomId, game) {
  const channel = makeGameChannel(roomId);
  await channel.send({
    type: 'broadcast',
    event: 'game_state',
    payload: JSON.parse(JSON.stringify(game)),
  });
}

export async function sendPlayerAction(roomId, action) {
  const channel = makeGameChannel(roomId);
  await channel.send({
    type: 'broadcast',
    event: 'player_action',
    payload: action,
  });
}
