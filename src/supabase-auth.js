// ============================================================
// Supabase Auth helpers for abyssTCG
//
// Mirrors the simple auth flow used by spire-climber:
//   - auto anonymous sign-in on page load
//   - optional GitHub OAuth sign-in
//   - sign-out
// ============================================================

import { supabaseClient } from './supabase-config.js';

let currentUser = null;

export async function initAuth(onUserChange) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    if (onUserChange) onUserChange(currentUser);
  } else {
    const { data, error } = await supabaseClient.auth.signInAnonymously();
    if (!error && data.user) {
      currentUser = data.user;
      if (onUserChange) onUserChange(currentUser);
    } else if (onUserChange) {
      onUserChange(null);
    }
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && session.user) {
      currentUser = session.user;
      if (onUserChange) onUserChange(currentUser);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      if (onUserChange) onUserChange(null);
    }
  });
}

export async function signInWithGitHub() {
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  });
  if (error) console.error('[auth] GitHub sign-in failed:', error.message);
  return !error;
}

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) console.error('[auth] sign out failed:', error.message);
  currentUser = null;
  return !error;
}

export function getCurrentUser() {
  return currentUser;
}

export function getDisplayName(user) {
  if (!user) return '未登录';
  if (user.is_anonymous) return `游客#${user.id.substring(0, 6)}`;
  const meta = user.user_metadata || {};
  return meta.user_name || meta.full_name || meta.name || user.email || `用户#${user.id.substring(0, 6)}`;
}
