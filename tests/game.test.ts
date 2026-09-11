import { beforeAll, it, expect } from 'vitest';
import { initPhysics, MarblePhysics } from '../src/shared/physics';
import { MarbleGame } from '../src/shared/game';
import { CONFIG } from '../src/shared/map';
import type { Shot } from '../src/shared/types';
beforeAll(initPhysics);
const shot = (g: MarbleGame, patch: Partial<Shot> = {}): Shot => ({
  id: crypto.randomUUID(),
  match: g.snapshot().match,
  turn: g.snapshot().turn,
  direction: { x: 0, z: -1 },
  power: 0.14,
  serveX: 0.65,
  ...patch,
});
function finishMotion(g: MarbleGame) {
  for (let i = 0; i < 2400 && g.snapshot().phase === 'moving'; i++) g.tick(1 / 120);
}
it('starts empty and only first player may serve', () => {
  const g = new MarbleGame(0, 1, 0);
  expect(g.snapshot().balls).toEqual([]);
  expect(g.shoot(1, shot(g)).ok).toBe(false);
  expect(g.shoot(0, shot(g)).ok).toBe(true);
  expect(g.snapshot().balls[0].position.y).toBeGreaterThan(0.7);
  g.dispose();
});
it('rejects invalid, outward and stale commands without creating a body', () => {
  const g = new MarbleGame(0, 1, 0);
  for (const s of [
    shot(g, { power: NaN }),
    shot(g, { direction: { x: 0, z: 1 } }),
    shot(g, { serveX: 10 }),
    shot(g, { turn: 99 }),
    shot(g, { match: 99 }),
    shot(g, { power: 2 }),
  ])
    expect(g.shoot(0, s).ok).toBe(false);
  expect(g.snapshot().balls).toEqual([]);
  g.dispose();
});
it('first settles then second serves at ground height', () => {
  const g = new MarbleGame(0, 1, 0);
  g.shoot(0, shot(g));
  finishMotion(g);
  expect(g.snapshot().phase).toBe('aiming');
  expect(g.snapshot().active).toBe(1);
  expect(g.shoot(1, shot(g, { serveX: -0.65 })).ok).toBe(true);
  expect(g.snapshot().balls.find((b) => b.player === 1)!.position.y).toBeLessThan(0.1);
  finishMotion(g);
  expect(g.snapshot().served).toEqual([true, true]);
  expect(g.snapshot().active).toBe(0);
  expect(g.snapshot().round).toBe(2);
  g.dispose();
});
it('rejects repeated shot and shot while moving', () => {
  const g = new MarbleGame(0, 1, 0),
    s = shot(g);
  g.shoot(0, s);
  expect(g.shoot(0, s).ok).toBe(false);
  expect(g.shoot(0, shot(g)).ok).toBe(false);
  g.dispose();
});
it('serve timeout ends game', () => {
  const g = new MarbleGame(0, 1, 0);
  g.tick(31);
  expect(g.snapshot().result).toMatchObject({ winner: 1, reason: 'timeout' });
  g.dispose();
});
it('forfeit result cannot be overwritten by later events', () => {
  const g = new MarbleGame(0, 1, 0);
  g.forfeit(0);
  g.tick(31);
  g.forfeit(1);
  expect(g.snapshot().result?.winner).toBe(1);
  g.dispose();
});
it('reset alternates first player and returns empty field', () => {
  const g = new MarbleGame(0, 1, 0);
  g.shoot(0, shot(g));
  g.reset();
  expect(g.snapshot().first).toBe(1);
  expect(g.snapshot().active).toBe(1);
  expect(g.snapshot().balls).toEqual([]);
  g.dispose();
});
it('shrinks only after both turns of round four and while settled', () => {
  const g = new MarbleGame(0, 1, 0);
  for (let n = 0; n < 8; n++) {
    const s = g.snapshot();
    expect(s.phase).toBe('aiming');
    expect(
      g.shoot(s.active, shot(g, { power: 0.1, serveX: s.active === 0 ? 0.65 : -0.65 })).ok,
    ).toBe(true);
    expect(g.snapshot().boundary).toBe(CONFIG.half);
    finishMotion(g);
    if (n < 7) expect(g.snapshot().boundary).toBe(CONFIG.half);
  }
  expect(g.snapshot().boundary).toBeCloseTo(CONFIG.half * 0.92);
  expect(g.snapshot().round).toBe(5);
  expect(g.snapshot().phase).toBe('shrinking');
  g.dispose();
});
it('ordinary timeout skips once, consecutive own timeouts lose', () => {
  const g = new MarbleGame(0, 1, 0);
  g.shoot(0, shot(g));
  finishMotion(g);
  g.shoot(1, shot(g, { serveX: -0.65 }));
  finishMotion(g);
  g.tick(31);
  expect(g.snapshot().active).toBe(1);
  expect(g.snapshot().result).toBeNull();
  g.tick(31);
  expect(g.snapshot().active).toBe(0);
  g.tick(31);
  expect(g.snapshot().result).toMatchObject({ winner: 1, reason: 'timeout' });
  g.dispose();
});
it('new match rejects old match commands even at same turn number', () => {
  const g = new MarbleGame(0, 1, 0);
  const s = shot(g);
  g.reset();
  expect(g.shoot(1, s).ok).toBe(false);
  expect(g.snapshot().balls).toEqual([]);
  g.dispose();
});
it('keeps the decisive motion playing beyond two seconds without changing the result', () => {
  const g = new MarbleGame(0, 1, 0);
  // An unobstructed floor isolates the time limit from the yard's real stopping obstacles.
  g.physics.dispose();
  g.physics = new MarblePhysics({ flat: true });
  g.shoot(0, shot(g, { power: 1 }));
  finishMotion(g);
  expect(g.snapshot().phase).toBe('finished');
  const result = g.snapshot().result;
  for (let i = 0; i < 264; i++) g.tick(1 / 120);
  const before = g.snapshot().balls[0].position;
  for (let i = 0; i < 12; i++) g.tick(1 / 120);
  expect(g.snapshot().balls[0].position).not.toEqual(before);
  expect(g.snapshot().result).toEqual(result);
  g.dispose();
});

it.each([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
])('keeps an outgoing marble above the courtyard until the result overlay (%s, %s)', (x, z) => {
  const g = new MarbleGame(0, 1, 123);
  g.shoot(0, shot(g));
  const body = g.physics.bodies.get(0)!;
  body.setTranslation({ x: x * (CONFIG.half - 0.01), y: 0.07, z: z * (CONFIG.half - 0.01) }, true);
  body.setLinvel({ x: x * 2.5, y: 0, z: z * 2.5 }, true);
  finishMotion(g);
  const result = g.snapshot().result;
  expect(result?.reason).toBe('out');
  const start = { ...body.translation() };
  let travelled = 0;
  for (let i = 0; i < 216; i++) {
    g.tick(CONFIG.dt);
    const p = body.translation();
    expect(p.y).toBeGreaterThan(0.02);
    travelled = Math.max(travelled, Math.hypot(p.x - start.x, p.z - start.z));
    expect(g.snapshot().result).toEqual(result);
  }
  expect(travelled).toBeGreaterThan(0.05);
  g.dispose();
});
