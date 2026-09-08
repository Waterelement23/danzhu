import { beforeAll, describe, it, expect } from 'vitest';
import { MarblePhysics, initPhysics } from '../src/shared/physics';
import { CONFIG, terrainHeight } from '../src/shared/map';
beforeAll(initPhysics);
describe('real rigid body physics', () => {
  it('starts empty and releases first ball at standing height', () => {
    const p = new MarblePhysics();
    expect(p.states()).toEqual([]);
    p.serve(0, 0, true, { x: 0, z: -1 }, 0.4);
    expect(p.states()[0].position.y).toBeCloseTo(terrainHeight(0, 1.5) + 0.8);
    expect(p.states()[0].velocity.y).toBe(0);
    p.dispose();
  });
  it('ground serve starts one radius above ground', () => {
    const p = new MarblePhysics();
    p.serve(1, 0.4, false, { x: 0, z: -1 }, 0.2);
    expect(p.states()[0].position.y).toBeCloseTo(terrainHeight(0.4, 1.5) + CONFIG.radius, 3);
    p.dispose();
  });
  it('high release falls under gravity and bounces', () => {
    const p = new MarblePhysics({ flat: true });
    p.addBall(0, { x: 0, y: 0.8, z: 0 }, { x: 0.2, y: 0, z: 0 });
    let bounced = false,
      downward = false;
    for (let i = 0; i < 140; i++) {
      p.step(CONFIG.dt, 10, 0);
      const b = p.states()[0];
      if (b.velocity.y < -0.5) downward = true;
      if (downward && b.velocity.y > 0.2) bounced = true;
    }
    expect(bounced).toBe(true);
    p.dispose();
  });
  it('does not settle at an airborne apex', () => {
    const p = new MarblePhysics({ flat: true });
    p.addBall(0, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(p.settled()).toBe(false);
    p.dispose();
  });
  it('ground rolling eventually stops with support', () => {
    const p = new MarblePhysics({ flat: true });
    p.addBall(0, { x: 0, y: CONFIG.radius, z: 0 }, { x: 0.6, y: 0, z: 0 });
    for (let i = 0; i < 120 * 10; i++) p.step(CONFIG.dt, 10, 0);
    expect(p.settled()).toBe(true);
    p.dispose();
  });
  it.each(['hit-first', 'out-first'] as const)(
    'orders %s within the same nominal step',
    (which) => {
      const p = new MarblePhysics({ flat: true });
      const r = CONFIG.radius;
      // Place both events inside 1/120 s; second ball may be beyond boundary solely as a timing fixture.
      const x = which === 'hit-first' ? 1.492 : 1.496;
      p.addBall(0, { x, y: 0.2, z: 0 }, { x: 4, y: 0, z: 0 });
      p.addBall(
        1,
        { x: which === 'hit-first' ? 1.495 + 2 * r : 1.51 + 2 * r, y: 0.2, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      const event = p.step(CONFIG.dt, 1.5, 0, { ignoreInitialOutside: true });
      expect(event?.winner).toBe(which === 'hit-first' ? 0 : 1);
      p.dispose();
    },
  );
  it('detects a fast collision rather than passing through a sphere', () => {
    const p = new MarblePhysics({ flat: true });
    p.addBall(0, { x: -0.1, y: 0.2, z: 0 }, { x: 20, y: 0, z: 0 });
    p.addBall(1, { x: 0, y: 0.2, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(p.step(CONFIG.dt, 10, 0)?.reason).toBe('hit');
    p.dispose();
  });
  it('flying over another ball is not a hit', () => {
    const p = new MarblePhysics({ flat: true });
    p.addBall(0, { x: -0.1, y: 0.4, z: 0 }, { x: 20, y: 0, z: 0 });
    p.addBall(1, { x: 0, y: CONFIG.radius, z: 0 }, { x: 0, y: 0, z: 0 });
    expect(p.step(CONFIG.dt, 10, 0)).toBeNull();
    p.dispose();
  });
});
it('simultaneous-resolution window spans adjacent microsteps', () => {
  const p = new MarblePhysics({ flat: true });
  p.addBall(0, { x: 1.4996, y: 0.3, z: 0 }, { x: 4, y: 0, z: 0 });
  p.addBall(1, { x: 0, y: 0.3, z: 1.49928 }, { x: 0, y: 0, z: 4 });
  expect(p.step(CONFIG.dt, 1.5, 0)).toMatchObject({ winner: null, reason: 'draw' });
  p.dispose();
});
it('hard contact rebounds higher than soft contact', () => {
  const rebound = (restitution: number) => {
    const p = new MarblePhysics({ flat: true, restitution });
    p.addBall(0, { x: 0, y: 0.8, z: 0 });
    let touched = false,
      peak = 0;
    for (let i = 0; i < 180; i++) {
      p.step(CONFIG.dt, 10, 0);
      const b = p.states()[0];
      if (b.position.y < CONFIG.radius + 0.014) touched = true;
      if (touched) peak = Math.max(peak, b.position.y);
    }
    p.dispose();
    return peak;
  };
  expect(rebound(0.55)).toBeGreaterThan(rebound(0.05) + 0.1);
});
it('gravity moves an unsupported resting-on-slope ball downhill', () => {
  const p = new MarblePhysics(),
    x = 0.3,
    z = -0.48;
  p.addBall(0, { x, y: terrainHeight(x, z) + CONFIG.radius + 0.002, z });
  for (let i = 0; i < 180; i++) p.step(CONFIG.dt, 10, 0);
  expect(p.states()[0].position.x).toBeLessThan(x - 0.015);
  p.dispose();
});
it('existing airborne ball cannot receive a ground strike', () => {
  const p = new MarblePhysics({ flat: true });
  p.addBall(0, { x: 0, y: 0.8, z: 0 });
  expect(p.strike(0, { x: 1, z: 0 }, 0.5)).toBe(false);
  p.dispose();
});
it('slow grounded direct contact still produces a winning hit', () => {
  const p = new MarblePhysics({ flat: true });
  p.addBall(0, { x: -0.14, y: CONFIG.radius, z: 0 }, { x: 0.45, y: 0, z: 0 });
  p.addBall(1, { x: 0, y: CONFIG.radius, z: 0 });
  let event = null;
  for (let i = 0; i < 240 && !event; i++) event = p.step(CONFIG.dt, 10, 0);
  expect(event?.reason).toBe('hit');
  p.dispose();
});
