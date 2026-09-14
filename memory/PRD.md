# PRD — STREET KINGS („Don't take the heat.")

## Original Problem Statement
"Create an online game for me based on the 'Witches' card game by Amigo." — later fully reskinned (2026-06) to a
German-language modern gangster / street-crime setting **STREET KINGS**. Rules and mechanics are unchanged.

## User Choices
- Local pass-and-play + Solo vs AI + Online multiplayer (room code / link), 3–6 players
- Local browser stats; no AI-generated images on special cards (icon-based design kept)
- Reskin: whole app in **German**, gangster theme; card visuals/colours unchanged; hero background image removed
- Spectator: via the normal room link with "Mitspielen / Zuschauen" choice
- Reconnect: rejoin by same name takes over the abandoned seat (no token needed)

## Theme mapping (display only — engine keys unchanged)
| Engine key | Display |
|---|---|
| RED / YELLOW / BLUE / GREEN | Hitze / Schwarzmarkt / Cash / Ware |
| fire (Red 11) | Kingpin (Hitze x2, max 15) |
| water (Blue 11) | Fixer (+5 Hitze) |
| earth (Green 11) | Informant (−5 Hitze) |
| air (Yellow 11) | Schmierer (neutralisiert Fixer & Patin) |
| pygmy (Green 12) | Patin (+10 Hitze) |
| wizard | Laufjunge (Wert 0) |
| Fire points / Fire Spell | Hitze / Takeover (Fixer-/Patin-/Großer Takeover) |
| Avatars | Boss, Dealer, Fahrer, Schmuggler, Hacker, Anwalt |
| Bot names | Vito, Ronny, Kalle, Shorty, Dragan, Nadja, Ivo, Mischa |

## Architecture
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, framer-motion, lucide-react.
  - Engine `src/game/engine.js`, local reducer `useGame.js`, online hook `useOnlineGame.js`, API `api.js`.
  - App.js orchestrates home | local (LocalGame.jsx) | online (OnlineFlow.jsx → Lobby / OnlineTable).
- Backend: FastAPI + MongoDB. Python engine `witches_engine.py`; rooms in `server.py`.
  - Endpoints: POST /api/rooms, /rooms/{code}/join, /rooms/{code}/watch, /rooms/{code}/bots, /rooms/{code}/start,
    GET /rooms/{code}?token= (redacted per token, heartbeat updates last_seen), POST /rooms/{code}/action.
  - Rooms TTL 12h idle. Short polling ~1.3s.

## Game Rules (unchanged Amigo "Witches")
- 60 cards: 4 colours 1–14 + 4 Laufjungen (0). Red = 1 Hitze each. Specials as table above.
- Follow led colour; highest of led colour wins; winner leads. Passing 3/3/2/1 rotating direction.
- Takeover (all 14 red): shooter 0, others +20/25/30 (Informant −5). Game ends at 70; lowest wins.

## Implemented
- 2026-06 (earlier): full game loop, rules/stats dialogs, sounds, bots, icon-based specials, framer-motion
  arc/sweep animations, online multiplayer with rooms + deep link, TTL cleanup.
- 2026-06 (this iteration):
  - Full German gangster reskin of all UI text, constants, rules, stats, avatars, bot names, spell names, index.html.
  - Spectator mode: `POST /rooms/{code}/watch` → `spec-` token; view has `isSpectator`, `spectators[]`;
    invite screen (?room=CODE) offers Mitspielen / Zuschauen; spectator UI hides hand & actions.
  - Reconnect grace: players carry `last_seen` (heartbeat on GET); `connected` flag in view (offline after 10s,
    WifiOff icon in roster/lobby). Join with same name (case-insensitive) of an offline player → takes over seat
    with new token (`rejoined: true`); host token transferred if host. Connected duplicate → 409. New name after
    start → 409. localStorage session resume still works (also for spectators).
  - Testing: iteration_3 passed (backend pytest in /app/backend/tests/test_streetkings.py + Playwright).

## Backlog / Next
- P2: Configurable end threshold / fixed number of rounds.
- P2: Rematch in the same online room (currently returns to lobby/home).
- P2: Spectator chat / reactions; kick offline player & replace with bot (host).
- P3: Optional noir visual pass (fonts/colours) — explicitly deferred by user for this step.
