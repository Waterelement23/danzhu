import { expect, it } from 'vitest';
import { ReturnCancel } from '../src/client/return-cancel';
import { touchAim } from '../src/client/match-ui';
it('preserves light first pulls without arming the larger cancel zone', () => {
  const state = new ReturnCancel();
  for (const distance of [6, 10, 15, 20, 10]) {
    expect(state.update(distance)).toBe(false);
    expect(touchAim(0, distance, 132).power).toBeGreaterThan(0.045);
  }
  expect(state.armed).toBe(false);
});
it('arms after a deliberate pull and cancels only on return', () => {
  const state = new ReturnCancel();
  expect(state.update(40)).toBe(false);
  expect(state.armed).toBe(true);
  expect(state.update(20)).toBe(false);
  expect(state.update(14)).toBe(true);
});
it('uses hysteresis to keep boundary jitter from alternating shoot and cancel', () => {
  const state = new ReturnCancel();
  state.update(40);
  state.update(12);
  for (const distance of [14, 17, 21, 15, 0]) expect(state.update(distance)).toBe(true);
  expect(state.update(22)).toBe(false);
  expect(state.update(18)).toBe(false);
  expect(state.update(14)).toBe(true);
});
it('a new gesture starts with no inherited cancel state', () => {
  const state = new ReturnCancel();
  state.update(50);
  state.update(0);
  state.clear();
  expect(state.armed).toBe(false);
  expect(state.update(8)).toBe(false);
});
