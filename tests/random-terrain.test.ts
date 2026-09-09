import { beforeAll, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  createTerrain,
  makeTerrain,
  terrainHeight,
  CONFIG,
  COURT_SCALE,
  SERVE_Z,
  validTerrainSeed,
} from '../src/shared/map';
import { initPhysics, MarblePhysics } from '../src/shared/physics';
import { MarbleGame } from '../src/shared/game';
import { ServePredictor } from '../src/shared/serve-preview';
beforeAll(initPhysics);
it('same seed reproduces geometry, colours and rocks without sharing mutable arrays', () => {
  const a = createTerrain(7381),
    b = createTerrain(7381),
    c = createTerrain(7382);
  expect(a).toEqual(b);
  expect(a.heights).not.toBe(b.heights);
  expect(a.heights).not.toEqual(c.heights);
  expect(a.colors).not.toEqual(c.colors);
  expect(a.rocks).not.toEqual(c.rocks);
  expect(makeTerrain(a).vertices).toEqual(makeTerrain(b).vertices);
});
it('rejects invalid seeds rather than silently falling back to another court', () => {
  for (const seed of [NaN, Infinity, -1, 0.5, 2 ** 32, undefined, '7']) {
    expect(validTerrainSeed(seed)).toBe(false);
    expect(() => createTerrain(seed as number)).toThrow();
  }
});
it('many seeds have readable relief, finite geometry, separated stones and a level serve strip', () => {
  for (let seed = 1; seed <= 24; seed++) {
    const t = createTerrain(seed),
      min = Math.min(...t.heights),
      max = Math.max(...t.heights);
    expect(min).toBeGreaterThan(0);
    expect(max - min).toBeGreaterThan(0.04);
    expect(max).toBeLessThan(0.17);
    for (const x of [-0.9, 0, 0.9]) expect(terrainHeight(x, SERVE_Z, t)).toBeCloseTo(0.018, 6);
    expect(t.rocks.length).toBeGreaterThan(130);
    for (const r of t.rocks) {
      expect(Math.abs(r.z) + r.radius).toBeLessThan(1.3 * COURT_SCALE);
      expect(r.y).toBeCloseTo(terrainHeight(r.x, r.z, t), 10);
    }
    for (let i = 0; i < t.rocks.length; i++)
      for (let j = 0; j < i; j++) {
        const a = t.rocks[i],
          b = t.rocks[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.radius + b.radius + 0.0249);
      }
  }
});
it('rendered triangles, terrain height and Rapier agree on several independently generated maps', () => {
  for (const seed of [71, 932, 40201]) {
    const t = createTerrain(seed),
      mesh = makeTerrain(t),
      world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(
        mesh.vertices,
        mesh.indices,
        RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
      ),
    );
    world.step();
    for (const [x, z] of [
      [-0.72, 0.56],
      [0.63, -0.51],
      [-0.17, 0.07],
      [0.9, 1.5],
    ]) {
      const hit = world.castRay(new RAPIER.Ray({ x, y: 2, z }, { x: 0, y: -1, z: 0 }), 3, true)!;
      expect(2 - hit.timeOfImpact).toBeCloseTo(terrainHeight(x, z, t), 5);
    }
    world.free();
  }
});
it('rooms retain independent terrain; ticks preserve the seed and rematch changes it', () => {
  const a = new MarbleGame(0, 1, 71),
    b = new MarbleGame(1, 1, 932);
  const old = a.physics.terrain.heights.slice();
  a.tick(0.1);
  expect(a.snapshot().terrainSeed).toBe(71);
  const seed = b.snapshot().terrainSeed;
  b.reset();
  expect(b.snapshot().terrainSeed).not.toBe(seed);
  expect(b.snapshot().first).toBe(0);
  expect(a.physics.terrain.heights).toEqual(old);
  expect(a.snapshot().terrainSeed).toBe(71);
  a.dispose();
  b.dispose();
});
it('predicted first contact uses the current seed and agrees with the first airborne physical leg', async () => {
  for (const seed of [71, 932, 40201]) {
    const terrain = createTerrain(seed),
      predictor = await ServePredictor.create(terrain),
      p = new MarblePhysics({ terrain });
    const flight = predictor.predict(0.15, { x: 0, z: -1 }, 0.55, CONFIG.half);
    p.serve(0, 0.15, true, { x: 0, z: -1 }, 0.55);
    const steps = Math.floor((flight.time - 0.03) / CONFIG.dt);
    for (let i = 0; i < steps; i++) p.step(CONFIG.dt, 10, 0);
    const actual = p.states()[0].position,
      expected = flight.points[steps * 2];
    expect(
      Math.hypot(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z),
    ).toBeLessThan(0.012);
    predictor.dispose();
    p.dispose();
  }
});
it('a generated pebble has a measurable collision effect, not just a visual decoration', () => {
  const terrain = createTerrain(71),
    r = terrain.rocks[6],
    states = [];
  for (const include of [true, false]) {
    const t = include ? terrain : { ...terrain, rocks: terrain.rocks.filter((x) => x !== r) };
    const p = new MarblePhysics({ terrain: t }),
      x = r.x - 0.14,
      z = r.z + r.radius * 0.4;
    p.addBall(
      0,
      { x, y: terrainHeight(x, z, t) + CONFIG.radius + 0.004, z },
      { x: 0.7, y: 0, z: 0 },
    );
    for (let i = 0; i < 70; i++) p.step(CONFIG.dt, 10, 0);
    states.push(p.states()[0].position);
    p.dispose();
  }
  expect(
    Math.hypot(states[0].x - states[1].x, states[0].y - states[1].y, states[0].z - states[1].z),
  ).toBeGreaterThan(0.001);
});
