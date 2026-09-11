import { expect, it } from 'vitest';
import { ReturnCancel, meterPosition } from '../src/client/return-cancel';
import { touchAim } from '../src/client/match-ui';

it('allows a light initial drag from the marble before returning to cancel is armed', () => {
  const state = new ReturnCancel();
  state.begin(0, 18);
  for (const distance of [6, 10, 15, 20, 10]) {
    expect(state.update(distance, 18)).toBe(false);
    expect(touchAim(0, distance, 132).power).toBeGreaterThan(0.045);
  }
});
it('an off-ball drag can cancel directly on the marble without returning to its touch origin', () => {
  const state = new ReturnCancel();
  state.begin(120, 18);
  expect(state.update(16, 18)).toBe(true);
});
it('requires leaving the marble before an on-ball gesture can return to cancel', () => {
  const state = new ReturnCancel();
  state.begin(0, 18);
  expect(state.update(12, 18)).toBe(false);
  expect(state.update(40, 18)).toBe(false);
  expect(state.update(18, 18)).toBe(true);
  for (const distance of [20, 25, 19, 0]) expect(state.update(distance, 18)).toBe(true);
  expect(state.update(26, 18)).toBe(false);
  expect(state.update(22, 18)).toBe(false);
});
it('scales the cancellation area with a large projected marble and resets per gesture', () => {
  const state = new ReturnCancel();
  state.begin(80, 30);
  expect(state.update(29, 30)).toBe(true);
  expect(state.update(37, 30)).toBe(true);
  expect(state.update(38, 30)).toBe(false);
  state.clear();
  state.begin(0, 18);
  expect(state.update(8, 18)).toBe(false);
});
it('keeps the compact meter inside portrait and landscape bounds and off the marble', () => {
  for (const size of [
    { width: 390, height: 770 },
    { width: 844, height: 316 },
  ]) {
    for (const ball of [
      { x: 195, y: 300, radius: 12 },
      { x: 360, y: 100, radius: 20 },
      { x: 30, y: 25, radius: 15 },
    ]) {
      const p = meterPosition(ball, size);
      expect(p.x).toBeGreaterThanOrEqual(8);
      expect(p.y).toBeGreaterThanOrEqual(8);
      expect(p.x + 104).toBeLessThanOrEqual(size.width - 8);
      expect(p.y + 84).toBeLessThanOrEqual(size.height - 8);
      expect(p.x >= ball.x + ball.radius || p.x + 104 <= ball.x - ball.radius).toBe(true);
    }
  }
});
