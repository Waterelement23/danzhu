import { expect, it } from 'vitest';
import { pickServePosition, ServeTap } from '../src/client/serve-selection';
const samples = [
  { x: 100, y: 200, worldX: -1.14 },
  { x: 200, y: 190, worldX: 0 },
  { x: 300, y: 200, worldX: 1.14 },
];
it('picks the visible line including its larger touch target and clamps end caps', () => {
  expect(pickServePosition({ x: 200, y: 190 }, samples, 22)).toBeCloseTo(0);
  expect(pickServePosition({ x: 150, y: 195 }, samples, 22)).toBeCloseTo(-0.57);
  expect(pickServePosition({ x: 85, y: 200 }, samples, 22)).toBe(-1.14);
  expect(pickServePosition({ x: 315, y: 200 }, samples, 22)).toBe(1.14);
  expect(pickServePosition({ x: 200, y: 212 }, samples, 22)).not.toBeNull();
});
it('ignores the rest of the field, other boundaries, and empty samples', () => {
  expect(pickServePosition({ x: 200, y: 230 }, samples, 22)).toBeNull();
  expect(pickServePosition({ x: 100, y: 100 }, samples, 22)).toBeNull();
  expect(pickServePosition({ x: 200, y: 190 }, [], 22)).toBeNull();
});
it('selects only on release and tolerates small finger jitter', () => {
  const tap = new ServeTap();
  tap.begin(0.4);
  tap.move(4);
  expect(tap.finish()).toBe(0.4);
  expect(tap.finish()).toBeNull();
});
it('a drag never becomes selection when returned to its starting point', () => {
  const tap = new ServeTap();
  tap.begin(-0.6);
  tap.move(20);
  tap.move(0);
  expect(tap.finish()).toBeNull();
  tap.begin(0.6);
  tap.move(5);
  expect(tap.finish()).toBeNull();
});
it('cancellation and a subsequent gesture discard stale selection', () => {
  const tap = new ServeTap();
  tap.begin(0.7);
  tap.clear();
  expect(tap.finish()).toBeNull();
  tap.begin(0.7);
  tap.begin(null);
  expect(tap.finish()).toBeNull();
});
