# ⚔️ AbyssTCG

An original board-based card battler prototype — mana crystals grow every turn, you summon minions onto the board, and fight for face damage.

Live demo: https://sunsetzf2023.github.io/abyssTCG/

## Development

Built with [Vite](https://vite.dev) (ES modules, dev server, production bundling) and tested with [Vitest](https://vitest.dev).

```bash
npm install       # install dependencies
npm run dev       # local dev server with hot reload
npm run test      # run the engine test suite
npm run lint      # ESLint check
npm run build     # production build into dist/
npm run preview   # preview the production build locally
```

Every push to `main` runs lint + tests + build in CI (`.github/workflows/ci.yml`) and, if that
passes, builds and deploys `dist/` to GitHub Pages (`.github/workflows/deploy.yml`).

## Current scope (MVP)

This is an early, intentionally minimal slice focused on proving the core loop is fun before layering on more systems:

- **Growing mana**: gain +1 max mana crystal each turn (cap 10), fully refilled at the start of your turn
- **Board combat**: play minions (limited board size), attack face or enemy minions, minions have summoning sickness the turn they're played
- **Battlecry minions**: direct damage, healing, card draw, temporary buffs, token summons — all declarative effects defined in `src/cards.js` and triggered the moment the minion is played
- **5 factions**, each with a distinct identity, only one of which ships with real illustration art today (see roadmap below)
- **One simple greedy AI opponent** — no online/PVP mode yet

### Deliberately not in the MVP yet

- Keywords (Taunt, Charge, Deathrattle, Lifesteal, ...)
- Hero powers
- Deckbuilding UI (decks are auto-built: 2 copies of every card the faction owns)
- Multiplayer / online matches

## Factions

| Faction | Identity | Art status |
|---|---|---|
| ⚔️ Human — Order Legion | Steady stat-lines, board control spells | ✅ real illustrations |
| 🪓 Orc — Bloodrage Horde | Aggressive, high attack / low health | 🕒 icon placeholder |
| 💀 Undead — Withered Cult | Card draw & sacrifice value engine | 🕒 icon placeholder |
| 👿 Demon — Abyssal Legion | Self-damage for big tempo/value swings | 🕒 icon placeholder |
| 🐺 Beast — Wildclaw Tribe | Wide, cheap board, temporary buffs | 🕒 icon placeholder |

## File structure

- `index.html` — page structure, loads `src/main.js` as a module
- `src/main.js` — entry point, imports the stylesheet and boots the game
- `src/style.css` — styling
- `src/factions.js` — faction definitions (identity, color, art availability)
- `src/cards.js` — card database (all minions, some carry a battlecry effect), effects are small declarative descriptors
- `src/engine.js` — pure game logic: turn flow, mana, drawing, playing cards, combat, a greedy AI
- `src/game.js` — DOM rendering and click-based interaction wiring
- `public/assets/` — static assets (card art), copied as-is into the build
- `tests/` — Vitest test suite covering the engine (card data sanity, battlecry targeting, full-game simulations)

## Art roadmap

Only the Human faction currently reuses real illustrated card art. The other four factions render with an emoji/icon placeholder until dedicated art is produced for them — see the `assets/cards/` folder structure (one subfolder per faction) for where new art should land.

## Possible next steps

- Keyword system (Taunt first, since it changes targeting logic the most)
- Faction-specific hero powers
- Real art for Orc / Undead / Demon / Beast
- A deckbuilder screen instead of auto-built decks
- Persistent collection / progression, async or realtime PVP (similar to what we built for our other project, spire-climber)
