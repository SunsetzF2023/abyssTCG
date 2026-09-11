// ============================================================
// Supabase room / PVP client for abyssTCG
//
// Provides real-time 8-player room creation, joining, AI fill,
// invitations and online player list over Supabase.
//
// NOTE: This is the client-side layer. The matching local logic
// lives in src/autobattler/room.js and is used when playing offline.
// ============================================================

import { supabaseClient } from './supabase-config.js';
import { getCurrentUser, getDisplayName } from './supabase-auth.js';

const SLOT_COUNT = 8;
const EMPTY_SLOT = 'EMPTY';
const AI_SLOT = 'AI_ROBOT';

function randomRoomCode(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createRoom() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const roomCode = randomRoomCode();
  const slots = Object.fromEntries(
    Array.from({ length: SLOT_COUNT }, (_, i) => [`slot_${i}`, i === 0 ? user.id : EMPTY_SLOT]),
  );

  const { data, error } = await supabaseClient
    .from('ab_rooms')
    .insert({
      room_code: roomCode,
      host_id: user.id,
      status: 'lobby',
      ...slots,
    })
    .select()
    .single();

  if (error) throw error;

  await setCurrentRoom(data.id);
  return data;
}

export async function joinRoomByCode(roomCode) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const code = roomCode.trim().toUpperCase();

  // Use server-side function for atomic, RLS-safe join.
  // Falls back to direct update if the function is not deployed yet.
  const { data: rpcData, error: rpcError } = await supabaseClient
    .rpc('join_room_by_code', { p_code: code });

  if (rpcData) {
    await setCurrentRoom(rpcData.id);
    return rpcData;
  }

  if (rpcError && !/function .* does not exist/i.test(rpcError.message)) {
    throw rpcError;
  }

  // Fallback: direct client join (requires ab_rooms update policy to allow it)
  const { data: room, error: fetchError } = await supabaseClient
    .from('ab_rooms')
    .select('*')
    .eq('room_code', code)
    .eq('status', 'lobby')
    .single();

  if (fetchError) throw fetchError;
  if (!room) throw new Error('Room not found or already started');

  const firstEmpty = Array.from({ length: SLOT_COUNT }, (_, i) => i)
    .find((i) => room[`slot_${i}`] === EMPTY_SLOT);

  if (firstEmpty === undefined) throw new Error('Room is full');

  const updates = { [`slot_${firstEmpty}`]: user.id };
  const { data, error } = await supabaseClient
    .from('ab_rooms')
    .update(updates)
    .eq('id', room.id)
    .eq(`slot_${firstEmpty}`, EMPTY_SLOT)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Slot was taken, please try again');

  await setCurrentRoom(data.id);
  return data;
}

export async function fillRoomWithAI(roomId) {
  const { data: room, error: fetchError } = await supabaseClient
    .from('ab_rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (fetchError) throw fetchError;

  const updates = {};
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (room[`slot_${i}`] === EMPTY_SLOT) {
      updates[`slot_${i}`] = AI_SLOT;
    }
  }

  const { data, error } = await supabaseClient
    .from('ab_rooms')
    .update(updates)
    .eq('id', roomId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setRoomStatus(roomId, status) {
  const { data, error } = await supabaseClient
    .from('ab_rooms')
    .update({ status })
    .eq('id', roomId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToRoom(roomId, onUpdate) {
  const channel = supabaseClient
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ab_rooms', filter: `id=eq.${roomId}` },
      (payload) => onUpdate(payload.new),
    )
    .subscribe();

  return () => channel.unsubscribe();
}

export async function listOnlinePlayers() {
  const { data, error } = await supabaseClient
    .from('ab_profiles')
    .select('id, username, current_room_id')
    .eq('is_online', true)
    .is('current_room_id', null);

  if (error) throw error;
  return data || [];
}

export async function sendInvite(receiverId, roomCode) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const { data, error } = await supabaseClient
    .from('ab_invitations')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      room_code: roomCode,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function acceptInvite(inviteId, roomCode) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const { error: updateError } = await supabaseClient
    .from('ab_invitations')
    .update({ status: 'accepted' })
    .eq('id', inviteId)
    .eq('receiver_id', user.id);

  if (updateError) throw updateError;

  return joinRoomByCode(roomCode);
}

export async function rejectInvite(inviteId) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await supabaseClient
    .from('ab_invitations')
    .update({ status: 'rejected' })
    .eq('id', inviteId)
    .eq('receiver_id', user.id);

  if (error) throw error;
}

export function subscribeToInvites(onInvite) {
  const user = getCurrentUser();
  if (!user) return () => {};

  const channel = supabaseClient
    .channel(`invites:${user.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ab_invitations', filter: `receiver_id=eq.${user.id}` },
      (payload) => onInvite(payload.new),
    )
    .subscribe();

  return () => channel.unsubscribe();
}

export async function ensureProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('ab_profiles')
    .upsert({
      id: user.id,
      username: getDisplayName(user),
      is_online: true,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setOnlineStatus(online) {
  const user = getCurrentUser();
  if (!user) return;

  const { error } = await supabaseClient
    .from('ab_profiles')
    .update({ is_online: online })
    .eq('id', user.id);

  if (error) throw error;
}

export async function setCurrentRoom(roomId) {
  const user = getCurrentUser();
  if (!user) return;

  const { error } = await supabaseClient
    .from('ab_profiles')
    .update({ current_room_id: roomId })
    .eq('id', user.id);

  if (error) throw error;
}
