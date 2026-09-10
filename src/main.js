// Entry point — Vite picks this up as the module graph root.
import './style.css';
import './game.js';
import { startAutobattler, setupAutobattlerEvents } from './autobattler/ui.js';

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
