# Approved gesture audio integration

User approved processing and in-game use of selected A launch / continuous C charge, with silent cancellation. Work in existing initial worktree, preserve other edits.

1. Add accepted-shot audio events to the authoritative snapshot stream (GameSound union); only after a successful serve/strike. Share event IDs/timeline with collisions, bump protocol. Tests reject invalid shots, timestamp one successful shot, no duplicate/reconnect replay, two clients receive the same launch.
2. Add pure ChargeMotion gating: explicit begin, increasing power updates activity, hold/direction-only/decrease/end are silent; stale input expires. Tests before implementation.
3. Add bounded short overlapping source windows over the approved C clip, indexed by power, no whole-clip loop. Stop on gesture end, stale updates, mute, hidden, inactive, reset, turn change. A launch plays at displayed event time through existing spatial audio.
4. Wire actual pointer drag and precision power-slider gestures; preview redraws/angle/serve-position changes cannot trigger charge. Add only charge.wav and launch.wav to public/audio, update credits.
5. Verify targeted tests, complete test/build, actual browser decode/charge/hold/cancel/launch, update design evidence. No push requested.

## Completed verification

- Typecheck and production build passed; 64 tests across 12 files passed, including two real WebSocket clients receiving the same launch and earth events.
- Chrome real AudioContext passed 28 checks, including decoded 22 buffers, audible continuous charge beyond clip length, hold/decrease/cancel silence, bounded sources, launch display-time gating, deduplication, mute/reset cleanup.
- Actual practice shot moved from launch=0 to launch=1, followed by earth=3 / stone=1; no game-origin console errors observed.
- IAB verification was limited by its audio clock remaining at 0.00533s despite reporting running. Actual signal verification used Chrome. No claim of subjective listening approval for runtime mixing.
- Source/license credits and current design documented; older candidate files remain offline. No commit or push performed.
