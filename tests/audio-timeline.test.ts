import { expect, it } from 'vitest';
import { AudioTimeline } from '../src/client/audio-timeline';
import { rollingLevel } from '../src/client/audio';
import type { GameSnapshot, ImpactSound, BallState } from '../src/shared/types';
const hit = (id: number, time: number): ImpactSound => ({
  id,
  time,
  kind: 'earth',
  player: 0,
  speed: 2,
  position: { x: 0, y: 0, z: 0 },
});
const frame = (time: number, sounds: ImpactSound[] = [], match = 1) =>
  ({ time, sounds, match, terrainSeed: 1 }) as GameSnapshot;
it('waits for display time, deduplicates repeated history and ignores older packets', () => {
  const q = new AudioTimeline();
  q.ingest(frame(0));
  q.ingest(frame(1.1, [hit(1, 1)]));
  expect(q.poll(0.95, true)).toEqual([]);
  expect(q.poll(1.02, true)).toEqual([hit(1, 1)]);
  q.ingest(frame(1.1, [hit(1, 1)]));
  q.ingest(frame(0.9, [hit(2, 0.8)]));
  expect(q.poll(1.1, true)).toEqual([]);
});
it('does not replay joining, muted, hidden, stale or previous-match impacts', () => {
  const q = new AudioTimeline();
  q.ingest(frame(1, [hit(1, 0.9)]));
  expect(q.poll(1, true)).toEqual([]);
  q.ingest(frame(2, [hit(2, 1.9)]));
  expect(q.poll(2, false)).toEqual([]);
  expect(q.poll(2, true)).toEqual([]);
  q.ingest(frame(3, [hit(3, 2.9)]));
  q.discard();
  expect(q.poll(3, true)).toEqual([]);
  q.ingest(frame(4, [hit(4, 3.5)]));
  expect(q.poll(4, true)).toEqual([]);
  q.ingest(frame(4.1, [hit(5, 4.1)]));
  q.ingest(frame(0, [], 2));
  expect(q.poll(4.2, true)).toEqual([]);
  q.ingest(frame(0.1, [hit(1, 0.1)], 2));
  expect(q.poll(0.1, true)).toHaveLength(1);
});
it('rolls only with physical support and increases level with world speed', () => {
  const ball = { grounded: true, rollingSpeed: 0.5 } as BallState;
  expect(rollingLevel(ball)).toBeGreaterThan(0);
  expect(rollingLevel({ ...ball, grounded: false })).toBe(0);
  expect(rollingLevel({ ...ball, rollingSpeed: 0 })).toBe(0);
  expect(rollingLevel({ ...ball, rollingSpeed: NaN })).toBe(0);
  expect(rollingLevel({ ...ball, rollingSpeed: 1 })).toBeGreaterThan(rollingLevel(ball));
});
