# Marble Duel Initial Prototype Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the bounded scene task and reviews; the primary agent implements and integrates the shared core and room service in this session.

**Goal:** 可在浏览器本机练习、通过房间码与好友进行真实物理 1V1 对战的初版。

**Architecture:** TypeScript shared map/physics/rules core, authoritative Node.js Colyseus rooms, Three.js browser rendering. Practice uses the same core. Serve styles and chronological results follow the approved game design.

**Tech Stack:** Node 24, TypeScript, Three.js, Rapier 3D WASM, Colyseus, Vite, Vitest, Playwright. Resolve and lock current stable packages using the bundled Node 24 runtime; system Node 20 is insufficient for current Colyseus.

## File boundaries
- `src/shared/types.ts`: serializable snapshot, shot and player types.
- `src/shared/map.ts`: common geometry/terrain and rock data, meter-scale constants.
- `src/shared/physics.ts`: Rapier world, launch, contact, energy loss, chronological event localization.
- `src/shared/game.ts`: turn state, shrinking, timeouts, shot validation, snapshots.
- `src/server/room.ts`, `src/server/index.ts`: Colyseus room, session lifecycle, HTTP/static service.
- `src/client/scene.ts`: independent Three.js rendering and pointer-to-world interface.
- `src/client/transport.ts`: practice and remote connections through common callbacks.
- `src/client/main.ts`, `src/client/style.css`: room/ready/play/result flows and responsive UI.
- `tests/physics.test.ts`, `tests/game.test.ts`, `tests/network.test.ts`: real simulation and network regressions.
- `scripts/browser-smoke.js`: two browser contexts, touch/viewport verification, screenshots.
- `README.md`: run, build, controls, test evidence and limits.

## Task 1 — Core contracts and physics
- [x] Install locked dependencies; define shared contracts before delegating rendering.
- [x] Write failing tests for empty field, high release, ground serve and collision-before-exit / exit-before-collision.
- [x] Implement map and Rapier body simulation with fixed steps, CCD, contact-only resistance and stable-support detection.
- [x] Localize earliest event by conservative swept candidates and subdivision; unit-test both orders within one nominal step and high-speed pass-through.
- [x] Verify falling height, bounce, incline, settle and all core tests using `npm test -- tests/physics.test.ts tests/game.test.ts`.

## Task 2 — Scene and input
- [x] Delegate only `src/client/scene.ts` after shared contracts exist. Scene draws common terrain, rocks, glass marbles, boundary and serve preview; exposes aim callback without owning rules.
- [x] Primary agent builds UI/transport while scene is implemented. Pointer capture, cancel, minimum/maximum force, touch and height-independent aim are required.
- [x] Review scene against gameplay spec and then quality; correct issues before completion.

## Task 3 — Rules and room
- [x] Test illegal/duplicate/stale shots, sequential serves, turn transitions, shrinking, timeouts and rematch before implementation.
- [x] Implement state machine with immutable shot metadata, result lock and phase timer.
- [x] Write real Colyseus two-client tests including third player rejection and reconnect.
- [x] Implement room membership, ready/rematch consensus, reconnection pause and disposal.
- [x] Run `npm test` and `npm run typecheck`.

## Task 4 — End-to-end browser product
- [x] Integrate scene, practice/remote adapters and Chinese responsive interface.
- [x] Check desktop and mobile layouts, serve preview, visible ball height, aim, turn status and result explanations.
- [x] Run two-context browser scenario creating/joining a room, readying and serving; verify both users share the same turn.
- [x] Fix browser errors and regressions, save screenshots to ignored artifacts.

## Task 5 — Delivery
- [x] `npm run typecheck`, `npm test`, `npm run build`, `npm run test:browser`, `git diff --check`.
- [x] Read-only spec review followed by code-quality review; address actionable findings.
- [x] Record actual implementation parameters and remaining deployment limits in docs/README.
- [x] Commit to isolated feature branch, leave a running local preview and report tested result. No remote publishing requested.

## Validation examples
```ts
expect(game.snapshot().balls).toEqual([]);
expect(first.position.y).toBeCloseTo(terrainHeight(first.position.x, first.position.z) + 0.8);
expect(game.shoot(1, shot)).toEqual({ ok: false, error: '还没轮到你' });
// Physics fixture must put contact and boundary crossing inside the same 1/120 s step.
expect(runFixture('hit-then-exit').result?.winner).toBe(0);
expect(runFixture('exit-then-hit').result?.winner).toBe(1);
```

No existing application/test baseline; repository previously contained approved design documents only. Worktree: `.worktrees/initial`, branch `feature/initial-prototype`.

## Implementation record

The primary agent implemented and integrated physics, rules, rooms and UI; a scoped subagent implemented the scene. Spec review and quality review were completed. Review findings for predictive contact, reconnect consensus, early disconnect recovery, cross-microstep timing window, back-forward cache, and support normals were addressed. Browser validation uses repeatable Playwright CLI scripts instead of @playwright/test. The feature branch and worktree are retained locally; no remote publishing was requested. See README for actual commands and limits.
