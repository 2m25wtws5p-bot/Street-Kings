# Mobile layout correction — 2026-10-07

## Scope

Presentation only. Game engines, scores, bot decisions, session recovery, private
exchange history and production database configuration are unchanged.

- Shared opaque paper lead-suit marker for local and online tables.
- Paper action buttons with separate exchange/trick action areas.
- Room code uses one unshadowed, non-wrapping label.
- Playing selection no longer inserts a preview below the hand; its confirmation
  hint is always mounted and reserves its height.
- Exchange preview reserves every slot before selection. Block-level preview
  buttons prevent an inline baseline from adding four pixels on selection.
- Cards use width-only sizing and a common 20:29 aspect ratio, including backs,
  selected cards, previews, trick cards and dialogs.
- Special cards have no automatic height offset. Selected cards may lift without
  changing their layout footprint. Desktop rows have room for this lift.

## Verification

- Production build: successful (CI mode).
- Frontend: 59 tests passed, including 12 new layout/interaction regressions.
- Sound checks: passed.
- Backend: 103 tests passed against an isolated loopback MongoDB/API; only
  existing framework deprecation warnings.
- Actual browser geometry checks, not simulated layout:
  - Online selection at 320×568, 375×667, 402×874 and 1280×900: hand position
    change 0 px; unchanged card dimensions; 20:29 ratio; no horizontal overflow.
  - Local four-card exchange at the same sizes: hand position change 0 px,
    preview height change 0 px, confirmation-button overlaps 0. All 20 cards and
    confirmation button fit the viewport.
  - Online complete-trick action at 320×568, 375×667, 393×852, 1280×900 and
    1920×1080: overlaps with cards 0; free hand/button gap 20 px on mobile,
    24 px on desktop. Collecting advances the trick.
  - Visible cards retain their ratio. Natural rotation of played cards changes
    their bounding rectangle, not the printed-card proportions.
  - In-hand special cards align with their row; room-code text shadow is `none`.

Browser checks use the in-app Chromium browser at responsive viewport sizes.
Physical iPhone/Safari rendering is not claimed to have been tested.

The new dependency-free regression suite runs in GitHub Actions alongside all
existing tests. Source/style contract checks complement browser geometry checks;
they do not claim to replace them.
