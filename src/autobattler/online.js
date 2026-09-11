// ============================================================
// Online PVP lobby UI — AbyssTCG
//
// Wires supabase-room.js into the DOM: create/join rooms,
// invite online players, and render the real-time 8-slot lobby.
// ============================================================

import {
  createRoom, joinRoomByCode, listOnlinePlayers, sendInvite, acceptInvite, rejectInvite,
  subscribeToInvites, subscribeToRoom, fillRoomWithAI, setRoomStatus, ensureProfile,
} from '../supabase-room.js';
import { getCurrentUser } from '../supabase-auth.js';

const menuScreen = () => document.getElementById('screen-pvp-menu');
const menuView = () => document.getElementById('ab-pvp-menu');
const lobbyView = () => document.getElementById('ab-pvp-lobby');

let currentRoom = null;
let currentRoomCode = null;
let unsubscribeRoom = null;
let unsubscribeInvites = null;
let onlineList = [];

export function initPvpMenu() {
  ensureProfile().catch(() => {});

  if (unsubscribeInvites) unsubscribeInvites();
  unsubscribeInvites = subscribeToInvites((invite) => {
    renderInvites([{ ...invite, isNew: true }]);
  });

  document.querySelectorAll('.screen').forEach((s) => s?.classList.add('hidden'));
  menuScreen()?.classList.remove('hidden');
  showMenuView();
  refreshOnlinePlayers();

  bindOnce('ab-pvp-create', 'click', onCreateRoom);
  bindOnce('ab-pvp-join', 'click', onJoinRoom);
  bindOnce('ab-pvp-refresh', 'click', refreshOnlinePlayers);
  bindOnce('ab-pvp-back', 'click', backToMenu);
  bindOnce('ab-pvp-fill-ai', 'click', onFillAI);
  bindOnce('ab-pvp-start', 'click', onStartGame);
  bindOnce('ab-pvp-lobby-back', 'click', showMenuView);
}

function bindOnce(id, event, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.replaceWith(el.cloneNode(true));
  document.getElementById(id).addEventListener(event, handler);
}

function showMenuView() {
  menuView()?.classList.remove('hidden');
  lobbyView()?.classList.add('hidden');
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  currentRoom = null;
  currentRoomCode = null;
}

function showLobbyView(room, code) {
  currentRoom = room;
  currentRoomCode = code;
  menuView()?.classList.add('hidden');
  lobbyView()?.classList.remove('hidden');
  document.getElementById('ab-pvp-room-code').textContent = `房间码：${code}`;
  renderPvpLobby(room);

  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = subscribeToRoom(room.id, (updatedRoom) => {
    currentRoom = updatedRoom;
    renderPvpLobby(updatedRoom);
  });
}

async function onCreateRoom() {
  try {
    const room = await createRoom();
    showLobbyView(room, room.room_code);
  } catch (e) {
    alert(`创建房间失败：${e.message}`);
  }
}

async function onJoinRoom() {
  const input = document.getElementById('ab-pvp-code');
  const code = input?.value?.trim().toUpperCase();
  if (!code) return;
  try {
    const room = await joinRoomByCode(code);
    showLobbyView(room, room.room_code);
  } catch (e) {
    alert(`加入房间失败：${e.message}`);
  }
}

async function onFillAI() {
  if (!currentRoom) return;
  try {
    await fillRoomWithAI(currentRoom.id);
  } catch (e) {
    alert(`填充 AI 失败：${e.message}`);
  }
}

async function onStartGame() {
  if (!currentRoom) return;
  try {
    await setRoomStatus(currentRoom.id, 'loading');
    alert('房主已启动游戏，PVP 游戏循环尚未接入');
  } catch (e) {
    alert(`启动失败：${e.message}`);
  }
}

function backToMenu() {
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  document.querySelectorAll('.screen').forEach((s) => s?.classList.add('hidden'));
  document.getElementById('screen-menu')?.classList.remove('hidden');
}

async function refreshOnlinePlayers() {
  try {
    onlineList = await listOnlinePlayers();
    renderOnlinePlayers();
  } catch (e) {
    console.error('[pvp] list online players failed:', e);
  }
}

function renderOnlinePlayers() {
  const container = document.getElementById('ab-pvp-online');
  if (!container) return;

  const user = getCurrentUser();
  const others = onlineList.filter((p) => p.id !== (user?.id || ''));

  if (others.length === 0) {
    container.innerHTML = '<div class="ab-pvp-empty">暂无在线玩家</div>';
    return;
  }

  container.innerHTML = others.map((p) => `
    <div class="ab-pvp-player" data-id="${p.id}">
      <span>${p.username || '未知玩家'}</span>
      <button class="ab-pvp-invite-btn" data-id="${p.id}">邀请</button>
    </div>
  `).join('');

  container.querySelectorAll('.ab-pvp-invite-btn').forEach((btn) => {
    btn.addEventListener('click', () => onInvite(btn.dataset.id));
  });
}

async function onInvite(receiverId) {
  if (!currentRoomCode) {
    alert('先创建或加入一个房间才能邀请');
    return;
  }
  try {
    await sendInvite(receiverId, currentRoomCode);
    alert('邀请已发送');
  } catch (e) {
    alert(`邀请失败：${e.message}`);
  }
}

function renderInvites(invites) {
  const container = document.getElementById('ab-pvp-invites');
  if (!container) return;

  if (!invites.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = invites.map((inv) => `
    <div class="ab-pvp-invite" data-id="${inv.id}">
      <span>玩家邀请你加入房间 ${inv.room_code}</span>
      <button class="ab-pvp-accept" data-id="${inv.id}" data-code="${inv.room_code}">接受</button>
      <button class="ab-pvp-reject" data-id="${inv.id}">拒绝</button>
    </div>
  `).join('');

  container.querySelectorAll('.ab-pvp-accept').forEach((btn) => {
    btn.addEventListener('click', () => onAcceptInvite(btn.dataset.id, btn.dataset.code));
  });

  container.querySelectorAll('.ab-pvp-reject').forEach((btn) => {
    btn.addEventListener('click', () => onRejectInvite(btn.dataset.id));
  });
}

async function onAcceptInvite(inviteId, roomCode) {
  try {
    const room = await acceptInvite(inviteId, roomCode);
    showLobbyView(room, room.room_code);
  } catch (e) {
    alert(`接受邀请失败：${e.message}`);
  }
}

async function onRejectInvite(inviteId) {
  try {
    await rejectInvite(inviteId);
    document.querySelector(`.ab-pvp-invite[data-id="${inviteId}"]`)?.remove();
  } catch (e) {
    alert(`拒绝邀请失败：${e.message}`);
  }
}

function renderPvpLobby(room) {
  const slotsEl = document.getElementById('ab-pvp-slots');
  const startBtn = document.getElementById('ab-pvp-start');
  const fillBtn = document.getElementById('ab-pvp-fill-ai');
  if (!slotsEl || !startBtn) return;

  const user = getCurrentUser();
  const isHost = user?.id === room.host_id;

  const userNames = {};
  for (let i = 0; i < 8; i++) {
    const slot = room[`slot_${i}`];
    if (slot && slot !== 'EMPTY' && slot !== 'AI_ROBOT') {
      userNames[slot] = `玩家#${slot.substring(0, 6)}`;
    }
  }

  slotsEl.innerHTML = Array.from({ length: 8 }, (_, i) => {
    const slot = room[`slot_${i}`];
    let label = '等待玩家...';
    if (slot === 'AI_ROBOT') label = 'AI';
    else if (slot !== 'EMPTY' && slot) label = userNames[slot] || '玩家';

    return `
      <div class="ab-pvp-slot">
        <span class="ab-pvp-slot-index">${i + 1}</span>
        <span class="ab-pvp-slot-name">${label}</span>
      </div>
    `;
  }).join('');

  const allFilled = Array.from({ length: 8 }, (_, i) => room[`slot_${i}`] !== 'EMPTY')
    .every(Boolean);
  startBtn.disabled = !allFilled || !isHost;

  if (!isHost) {
    fillBtn?.classList.add('hidden');
  } else {
    fillBtn?.classList.remove('hidden');
  }
}
