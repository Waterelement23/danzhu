# Game audio integration

Scope approved by user: integrate four audition-approved sound families. Default rolling B (implementation choice, not a user-selected variant). Keep A/C offline. No game rule or terrain changes.

1. Shared types/physics/game: append bounded timestamped impact history, surface classification, relative normal approach speed, and support/tangential rolling information. Capture post-result motion too. Deduplicate actual contact onset; exclude speculative contacts and negligible chatter. Increment protocol for added semantics. Tests: airborne/grounded, drop bounce, rock hit, glass hit, contact de-duplication, snapshot history and reset.
2. Client presentation: expose interpolated ball positions, contact data and listener pose from the same frame shown on screen. Audio timeline waits for presentation time, discards stale history on join/reconnect/tab resume, de-duplicates IDs and clears on match/session change.
3. Web Audio controller: lazy fetch/decode on user gesture, persistent master mute/volume, one rolling source per ball, position-dependent panning/distance, speed/contact-driven gain, separate impacts with variation and bounded voices. Suspend on hidden page, stop on home/reset, tolerate unavailable audio without blocking play. Do not replay deferred old effects after loading.
4. Public assets: include only B loop, 3 earth impacts, 8 marble and 8 stone impacts; source credits and processing notes. Keep source recordings/auditions outside public runtime assets.
5. Verify: targeted unit tests, full existing tests, typecheck/build, browser actual AudioContext decode/playback and gesture unlock, timing/no duplicates, mute/hidden/stop/reset. Log evidence and limitations; no claims of human listening.

## Completion evidence

- Implemented all five steps. B is the runtime rolling default; other approved variants remain offline.
- `npm test`: 59 tests in 10 files passed, including real two-client WebSocket comparison of authoritative impact histories.
- `npm run build`: TypeScript, Vite client and server bundle passed. Existing large-bundle warning remains.
- Browser fixture: 15 checks passed using real decoded WAV buffers and AudioContext/analyser signal, including stationary rolling, airborne stop, timing, three impact kinds, deduplication, node release, mute and session cleanup.
- Actual game practice: first serve emitted earth events; the second serve hit the opposing marble and emitted one glass event. Home had zero rolling/impact voices; mute UI toggled correctly. Browser console had no errors during that round.
- `git diff --check`: passed. No GitHub push performed for this task.
- Limits: browser signal tests do not replace human in-game listening; mobile hardware audio/performance not measured. Original rolling source license remains unprovided (recorded in CREDITS).
