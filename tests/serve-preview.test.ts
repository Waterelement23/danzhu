import { beforeAll, afterAll, expect, it } from 'vitest';
import { ServePredictor } from '../src/shared/serve-preview';
import { MarblePhysics } from '../src/shared/physics';
import { CONFIG } from '../src/shared/map';
let predictor: ServePredictor;
beforeAll(async () => {
  predictor = await ServePredictor.create();
});
afterAll(() => predictor.dispose());
it('predicts the actual standing flight up to first ground contact', () => {
  const preview = predictor.predict(0, { x: 0, z: -1 }, 0.25, CONFIG.half);
  expect(preview.kind).toBe('ground');
  expect(preview.time).toBeGreaterThan(0.3);
  const p = new MarblePhysics();
  p.serve(0, 0, true, { x: 0, z: -1 }, 0.25);
  const steps = Math.floor((preview.time - 0.02) / CONFIG.dt);
  for (let i = 0; i < steps; i++) p.step(CONFIG.dt, 10, 0);
  const actual = p.states()[0].position;
  const expected = preview.points[Math.round((steps * CONFIG.dt) / (CONFIG.dt / 2))];
  expect(
    Math.hypot(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z),
  ).toBeLessThan(0.01);
  p.dispose();
});
it('stops at an elevated stone instead of forecasting a ground point through it', () => {
  const p = predictor.predict(0.748, { x: 0, z: -1 }, 0.73, CONFIG.half);
  expect(p.kind).toBe('stone');
  expect(p.end.y).toBeGreaterThan(0.06);
  expect(p.points.at(-1)!.y).toBeGreaterThan(p.end.y);
});
it('marks an outward serve as out before it can land', () => {
  const p = predictor.predict(0.9, { x: 1, z: 0.1 }, 1, CONFIG.half);
  expect(p.kind).toBe('out');
  expect(p.time).toBe(0);
});
it('more power moves first contact farther and resetting direction does not keep the old path', () => {
  const a = predictor.predict(0, { x: 0, z: -1 }, 0.15, CONFIG.half);
  const b = predictor.predict(0, { x: 0, z: -1 }, 0.5, CONFIG.half);
  expect(b.end.z).toBeLessThan(a.end.z - 0.3);
  const c = predictor.predict(0.9, { x: 1, z: -0.2 }, 1, CONFIG.half);
  expect(c.kind).toBe('out');
  expect(c.end.x).toBeCloseTo(CONFIG.half, 5);
});
