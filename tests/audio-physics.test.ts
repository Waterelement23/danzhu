import { beforeAll, expect, it } from 'vitest';
import { initPhysics, MarblePhysics } from '../src/shared/physics';
import { CONFIG } from '../src/shared/map';
import { MarbleGame } from '../src/shared/game';
beforeAll(initPhysics);
it('reports real landings, airborne silence and stable ground without chatter', () => {
  const p = new MarblePhysics({ flat: true });
  p.addBall(0, { x: 0, y: 0.8, z: 0 }, { x: 0.4, y: 0, z: 0 });
  expect(p.states()[0].grounded).toBe(false);
  const hits = [];
  for (let i = 0; i < 480; i++) {
    p.step(CONFIG.dt, 10, 0);
    hits.push(...p.takeImpacts());
  }
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.length).toBeLessThan(12);
  expect(hits.every((e) => e.kind === 'earth' && e.speed >= 0.12)).toBe(true);
  expect(hits[0].speed).toBeGreaterThan(2);
  expect(p.states()[0].grounded).toBe(true);
  for (let i = 0; i < 120; i++) p.step(CONFIG.dt, 10, 0);
  expect(p.takeImpacts()).toHaveLength(0);
  p.dispose();
});
it('reports one glass contact and does not repeat it for persistent touching', () => {
  const p = new MarblePhysics({ flat: true });
  p.addBall(0, { x: -0.13, y: 0.2, z: 0 }, { x: 2, y: 0, z: 0 });
  p.addBall(1, { x: 0, y: 0.2, z: 0 });
  const hits = [];
  for (let i = 0; i < 40; i++) {
    p.step(CONFIG.dt, 10, 0, { adjudicate: false });
    hits.push(...p.takeImpacts());
  }
  expect(hits.filter((e) => e.kind === 'marble')).toHaveLength(1);
  expect(hits.find((e) => e.kind === 'marble')!.speed).toBeGreaterThan(1);
  p.dispose();
});
it('snapshots keep timestamped history across sends and clear it on rematch', () => {
  const g = new MarbleGame(0, 1, 1);
  g.shoot(0, { id: 'a', match: 1, turn: 1, direction: { x: 0, z: -1 }, power: 0.15, serveX: 0 });
  for (let i = 0; i < 100; i++) g.tick(CONFIG.dt);
  expect(g.snapshot().sounds!.length).toBeGreaterThan(0);
  const s = g.snapshot();
  expect(s.sounds).toEqual(g.snapshot().sounds);
  expect(s.sounds!.every((e) => e.time <= s.time && e.id > 0)).toBe(true);
  g.reset();
  expect(g.snapshot().sounds).toEqual([]);
  g.dispose();
});
it('classifies actual rock contacts separately from soil', () => {
  const p = new MarblePhysics();
  const rock = p.terrain.rocks[0];
  p.addBall(
    0,
    { x: rock.x - rock.radius - CONFIG.radius - 0.08, y: rock.y + rock.height * 0.5, z: rock.z },
    { x: 2, y: 0, z: 0 },
  );
  const hits = [];
  for (let i = 0; i < 60; i++) {
    p.step(CONFIG.dt, 10, 0, { adjudicate: false });
    hits.push(...p.takeImpacts());
  }
  expect(hits.some((e) => e.kind === 'stone')).toBe(true);
  p.dispose();
});
it('does not sound merely from flying near another marble', () => {
  const p = new MarblePhysics({ flat: true });
  p.addBall(0, { x: -0.2, y: 0.7, z: 0.13 }, { x: 2, y: 0, z: 0 });
  p.addBall(1, { x: 0, y: 0.7, z: 0 });
  for (let i = 0; i < 15; i++) p.step(CONFIG.dt, 10, 0, { adjudicate: false });
  expect(p.takeImpacts()).toEqual([]);
  p.dispose();
});
