# PRD — Street Kings (Don't take the Heat)

## Product

Street Kings is a browser-based trick-taking card game for 3–6 players with a
comic street-crime setting. It supports local pass-and-play, solo games against
bots, online rooms, spectators, German and English on each player's own device.

## Card identities

| Internal key | Card | Function |
|---|---|---|
| `RED` / `YELLOW` / `BLUE` / `GREEN` | Hitze / Schwarzmarkt / Cash / Ware | Four suits, ranks 1–14 |
| `kingpin` | Kingpin, red 11 | Doubles other red-card Heat, capped at 15 |
| `informant` | Informant, green 11 | Adds 5 Heat |
| `briber` | Schmierer, yellow 11 | Removes up to 5 Heat from this round |
| `fixer` | Fixer, blue 11 | Neutralizes captured Heat outside a Takeover |
| `godmother` | Patin, green 12 | Adds 10 Heat |
| `runner` | Laufjunge, no suit, rank 0 | Always playable; wins only an all-Runner trick |

## Architecture

- Frontend: React, CRA/CRACO, Tailwind, shadcn/ui, Framer Motion and Lucide.
  - `src/game/engine.js`: pure rules and bot logic.
  - `src/game/useGame.js`: local game reducer and `useStreetKingsGame` hook.
  - `src/game/useOnlineGame.js`: online polling and actions.
  - `src/game/api.js`: validated API responses and localized errors.
  - `src/i18n`: extensible per-viewer translation catalogs.
- Backend: FastAPI and MongoDB.
  - `backend/street_kings_engine.py`: server-authoritative rules and bots.
  - `backend/server.py`: rooms, token-based player access, chat and persistence.
  - Rooms expire after inactivity; clients use polling and receive redacted views.
- Hosting: static frontend plus a separate API service. Secrets are server-side.

## Rules summary

- 60 cards: 56 suited cards plus four Runners. All cards are dealt.
- Players pass 4 / 3 / 3 / 2 cards for 3 / 4 / 5 / 6 players respectively.
  The direction follows the player-count-specific cycle; every round has a pass.
- Follow the first played suit when possible. Runners may always be played.
  The highest card of the led suit wins; that player leads the next trick.
- Ordinary red cards add one Heat each; special effects follow the table above.
- A Takeover requires all 14 red cards plus Informant and/or Godmother.
  Its value is 20 / 25 / 30. The endgame exception prevents handing another
  player the win, deducting the Takeover value from the collector instead.
- When a player reaches 70 Heat, the lowest total wins; ties are possible.
- All human players confirm readiness before the next round.

## Presentation and interaction

- Shared player tiles show turn order, active player, passing progress and chat.
- Full illustrated trick cards remain visible separately from status/buttons.
- Smartphone hands use two overlapping rows, with stable size and position.
- Local sorting belongs to the viewer only, including a personal Chaos order.
- Twelve synthesized chat cues, a turn reminder, mute and mobile audio unlock.
- Rules and scoring explanations reuse the playable special-card illustrations.

## Compatibility

Stable physical card IDs are unchanged. Persisted card metadata is normalized
from suit and rank. Existing awarded scores and access tokens are retained.
Validated older browser statistics and room sessions can be copied to the
current Street Kings namespace without deleting the older records.

## Backlog

- Additional languages, including Spanish.
- Additional selectable visual themes.
- Optional house rules, configurable threshold and consensus-based actions.
