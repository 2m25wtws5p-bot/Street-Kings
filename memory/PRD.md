# PRD — Coven of Witches

## Original Problem Statement
"Create an online game for me based on the 'Witches' card game by Amigo."

## User Choices
- Local pass-and-play (multiple humans on one device)
- Flexible 3–6 players
- Cozy mystical / witchy theme (dark purples, candlelight, hand-drawn card art)
- Local stats saved in browser
- AI-generated custom witch card artwork

## Architecture
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, framer-motion, lucide-react.
  - Pure game engine in `src/game/engine.js`; reducer/controller in `src/game/useGame.js`.
  - Screens/components in `src/components/`. Web Audio synth in `src/game/sound.js`.
  - Stats persisted in localStorage (`src/game/storage.js`).
- Backend: FastAPI + MongoDB. Endpoints: `POST /api/games`, `GET /api/games/recent`, `GET /api/games/summary`.
- AI card art (Gemini) stored as URLs in `src/game/assets.js`.

## Game Rules Implemented (Amigo "Witches")
- 60-card deck: 4 colours (Red Goblins, Yellow Mongols, Blue Indians, Green Pygmies) 1–14 + 4 Wizards (value 0).
- Fire cards = all Red cards (1 pt each). Fire Witch (Red 11) doubles fire pts (max 15).
  Water Witch (Blue 11) +5, Earth Witch (Green 11) −5, Air Witch (Yellow 11) neutralizes Water+Pygmy,
  Pygmy Queen (Green 12) +10. Wizards value 0, never win unless all wizards.
- Trick-taking: follow led colour if able; highest of led colour wins; winner leads next.
- Card passing per round (3p:3, 4p:3, 5p:2, 6p:1; rotating direction).
- Fire Spell (shoot the moon): all 14 red cards → shooter 0, others +20/25/30.
- Game ends at 70 pts; lowest score wins.
- Pass-and-play privacy gates hide hands between turns.

## Implemented (2026-06)
- Full game loop: Setup → Pass gates → Passing → Trick play → Round scoring → Game over.
- Rules grimoire dialog, local stats grimoire, sound FX toggle.
- Backend persistence of finished games + recent chronicles feed.

## Backlog / Next
- P1: Optional single-player AI opponents.
- P2: Configurable end threshold / fixed number of rounds.
- P2: Card play arc animations (framer-motion) and richer number-card art.
