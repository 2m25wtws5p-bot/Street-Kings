# Stable hand and turn reminders — 2026-10-07

## Changes

- Online playing, waiting and trick completion render one persistent medium-card hand with identical spacing and reserved initial-deal rows.
- Selection lifts the chosen card without resizing it; hovering no longer moves unselected hand cards.
- A fixed status/action slot distinguishes your turn, waiting and a finished trick without changing the hand footprint.
- Local solo-vs-bots keeps the sole human's hand visible. Multiple-human handover gates and private bot hands remain protected.
- A human who has not played for 10 seconds receives a visual pulse, a persistent prompt and a brief two-tone cue, repeated every 10 seconds.
- Selection/polling do not restart that deadline. Changing turns, losing the connection, spectating, bot activity and unmounting cancel it. Hidden tabs resume with a fresh 10-second interval, not accumulated alerts.
- The existing sound toggle mutes reminders; audio refusal cannot prevent visual reminders or gameplay. Reduced motion uses a static highlight.

## Verification

- 84 frontend tests passed: identity (6), exchange (7), engine (9), stability (25), previous layout (13), reminder (10), stable hand (14).
- Sound checks passed, including mute/unmute, short cue bounds, node cleanup and refused audio.
- 103 backend tests passed in the isolated loopback audit database. Five existing dependency deprecation warnings, no failures or skips.
- Production build with CI warnings treated as errors passed. Whitespace diff check passed.
- Chromium browser: controlled online three-player game and local three/four-player solo games; passing, two-tap play, waiting, completed trick and continue action exercised.
- At 1280×900, all 18 remaining cards had exactly equal coordinates and 80×116 dimensions in waiting, completion and own-turn views. The reserved grid was 1024×258 in all three states.
- At 393×852, selecting a 64×92.8 card only lifted it 12px; the hand grid did not move or resize. Playing into the completed trick reset the reminder to zero and preserved the grid footprint.
- At 320×568, both three- and four-player hands fitted without vertical page overflow. The final four-player hand had 15 cards, a 304×149.4 grid, last card bottom below 562px and right edge below 312px.
- Real browser reminders incremented repeatedly; new turns restarted at zero. Exact 10/20/30-second deadlines, stale callbacks, hidden-tab timing and cleanup were also checked with a deterministic clock and hook harness.

Physical iPhone Safari and speaker playback were not available; mobile checks used Chromium viewport emulation. No game rules, API protocol, hosting plan or production database configuration changed.
