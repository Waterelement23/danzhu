import { expect, it } from 'vitest';
import { TurnCountdown } from '../src/client/turn-countdown';
it('shows 10 through 1 and sounds once per decreasing second', () => {
  const c = new TurnCountdown();
  expect(c.update('a', 10.1, true, true)).toEqual({ number: null, beep: false });
  expect(c.update('a', 10, true, true)).toEqual({ number: 10, beep: true });
  expect(c.update('a', 9.2, true, true).beep).toBe(false);
  expect(c.update('a', 9, true, true)).toEqual({ number: 9, beep: true });
  expect(c.update('a', 9.1, true, true).beep).toBe(false);
  expect(c.update('a', 0, true, true)).toEqual({ number: null, beep: false });
});
it('does not replay missed seconds, hidden or inactive countdowns', () => {
  const c = new TurnCountdown();
  c.update('a', 10, true, true);
  expect(c.update('a', 7, true, false)).toEqual({ number: null, beep: false });
  expect(c.update('a', 7, true, true).beep).toBe(false);
  expect(c.update('a', 4, true, true)).toEqual({ number: 4, beep: true });
  expect(c.update('a', 3, false, true)).toEqual({ number: null, beep: false });
  expect(c.update('a', 3, true, true).beep).toBe(false);
});
it('a new turn can sound again, invalid times stay silent', () => {
  const c = new TurnCountdown();
  c.update('a', 1, true, true);
  expect(c.update('b', 10, true, true).beep).toBe(true);
  expect(c.update('b', NaN, true, true)).toEqual({ number: null, beep: false });
});
