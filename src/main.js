// Entry point — Vite picks this up as the module graph root.
import './style.css';
import './game.js';
import './supabase-config.js';
import { supabaseClient } from './supabase-config.js';
import { startAutobattler, setupAutobattlerEvents } from './autobattler/ui.js';
import { initAuth, signInWithGitHub, signOut, getDisplayName } from './supabase-auth.js';

// ─── Supabase Auth ─────────────────────────────────────────────

initAuth((user) => {
  const nameEl = document.getElementById('ab-auth-name');
  const btn = document.getElementById('ab-auth-btn');
  if (nameEl) nameEl.textContent = getDisplayName(user);
  if (btn) btn.textContent = user && !user.is_anonymous ? '登出' : 'GitHub 登录';
});

if (document.getElementById('ab-auth-btn')) {
  document.getElementById('ab-auth-btn').addEventListener('click', async () => {
    const user = (await supabaseClient.auth.getSession()).data.session?.user;
    if (user && !user.is_anonymous) {
      await signOut();
    } else {
      await signInWithGitHub();
    }
  });
}

// ─── Mode selection ───────────────────────────────────────────

document.getElementById('mode-classic').addEventListener('click', () => {
  document.getElementById('mode-select')?.classList.add('hidden');
  document.getElementById('faction-grid').classList.remove('hidden');
});

document.getElementById('mode-autobattler').addEventListener('click', () => {
  startAutobattler();
});

// ─── Autobattler events ────────────────────────────────────────

setupAutobattlerEvents();
