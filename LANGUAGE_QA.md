# German / English interface verification — 2026-10-08

Scope: personal language selection and presentation only. Backend rules, card
identities, API game fields and scoring mechanics are unchanged.

## Automated checks

- 120 frontend tests passed, including catalog completeness, interpolation and
  plural parity, literal translation-key coverage, German defaults, invalid
  preferences, denied storage, local hot-seat selection, card-label immutability,
  live error translation and existing complete-game/session/layout regressions.
- Sound regression checks passed, including police reminders, gesture unlock,
  mute and refused audio.
- Strict production build (`CI=true`) succeeded.
- Whitespace/error check (`git diff --check`) passed.

## Browser checks

12 checks passed against the production frontend build and an isolated local
MongoDB/FastAPI server, with two independent human browser contexts (DE + EN) and
a bot in one three-player room. A full round completed, including 40 human card
plays and 20 trick collections. No uncaught browser errors were recorded.

Verified:

- A fresh browser defaults to German even when its browser locale is English.
- English selection before joining/creating; persistence across reloads;
  in-memory selection still works when browser storage is denied.
- Shared room, raw names/chat, stable cards and authoritative scores remain
  identical for German and English players. Only presentation differs.
- English rules, colored card effects, score explanations, dossier, card exchange
  and last-trick review; separate DE/EN preferences on a local hot-seat device.
- Language attributes on portal dialogs, including an English local player under
  a German page default; localized automatic spectator name.
- Passing, playing, complete-trick and score screens at 320×568, 393×852,
  1366×768 and 1920×1080. Responsive geometry checks and representative visual
  inspection found no new card/button overlap or text clipping.

23 screenshots and detailed browser results are retained in the ignored `.qa/`
directory of the development checkout, not published as application assets.
Responsive checks used Chromium; physical iPhone/Safari and Android-device
testing are not claimed.

## Future languages

See `frontend/src/i18n/README.md` for catalog registration and extension guidance.
The GitHub multiplayer workflow now includes the language checks. Human-created
names and messages are intentionally not machine translated.
