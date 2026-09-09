# ⚔️ AbyssTCG

An original board-based card battler prototype — mana crystals grow every turn, you summon minions onto the board, and fight for face damage. No backend, no build step: just open `index.html` or serve the folder with any static server.

Live demo (once GitHub Pages is enabled): https://sunsetzf2023.github.io/abyssTCG/

## Current scope (MVP)

This is an early, intentionally minimal slice focused on proving the core loop is fun before layering on more systems:

- **Growing mana**: gain +1 max mana crystal each turn (cap 10), fully refilled at the start of your turn
- **Board combat**: play minions (limited board size), attack face or enemy minions, minions have summoning sickness the turn they're played
- **Spells**: direct damage, healing, card draw, temporary buffs, token summons — all declarative effects defined in `js/cards.js`
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

- `index.html` / `style.css` — page structure and styling
- `js/factions.js` — faction definitions (identity, color, art availability)
- `js/cards.js` — card database (minions + spells), effects are small declarative descriptors
- `js/engine.js` — pure game logic: turn flow, mana, drawing, playing cards, combat, a greedy AI
- `js/game.js` — DOM rendering and click-based interaction wiring

## Art roadmap

Only the Human faction currently reuses real illustrated card art. The other four factions render with an emoji/icon placeholder until dedicated art is produced for them — see the `assets/cards/` folder structure (one subfolder per faction) for where new art should land.

## Possible next steps

- Keyword system (Taunt first, since it changes targeting logic the most)
- Faction-specific hero powers
- Real art for Orc / Undead / Demon / Beast
- A deckbuilder screen instead of auto-built decks
- Persistent collection / progression, async or realtime PVP (similar to what we built for our other project, spire-climber)
