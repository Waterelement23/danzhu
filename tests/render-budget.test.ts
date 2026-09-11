import { expect, it } from 'vitest';
import { FramePacer, pixelRatioFor, renderProfile } from '../src/client/render-budget';
it.each([60, 120, 144])('limits mobile rendering independently of a %s Hz display', (hz) => {
  const pacer = new FramePacer(30, 15);
  let count = 0,
    seconds = 0;
  for (let i = 0; i <= hz * 5; i++) {
    const dt = pacer.take((i * 1000) / hz, true, false);
    if (dt !== null) {
      count++;
      seconds += dt;
    }
  }
  expect(count).toBeGreaterThanOrEqual(149);
  expect(count).toBeLessThanOrEqual(151);
  expect(seconds).toBeCloseTo(5, 1);
});
it('idles at 15 fps and resumes without simulating hidden wall time', () => {
  const p = new FramePacer(30, 15);
  let count = 0;
  for (let i = 0; i < 120; i++) if (p.take((i * 1000) / 120, false, false) !== null) count++;
  expect(count).toBe(15);
  expect(p.take(2000, true, true)).toBeNull();
  expect(p.take(60000, true, false)).toBe(0);
  expect(p.take(60010, true, false)).toBeNull();
  expect(p.take(60034, true, false)).toBeCloseTo(0.034);
});
it('caps mobile pixel workload while preserving desktop settings', () => {
  const mobile = renderProfile(true),
    desktop = renderProfile(false);
  expect(pixelRatioFor(mobile, 390, 528, 3)).toBe(1.25);
  const ratio = pixelRatioFor(mobile, 1500, 1000, 3);
  expect(1500 * 1000 * ratio * ratio).toBeLessThanOrEqual(900001);
  expect(pixelRatioFor(desktop, 390, 528, 3)).toBe(2);
  expect(mobile.shadowSize).toBe(2048);
});
