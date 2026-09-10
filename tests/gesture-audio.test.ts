import { beforeAll, expect, it } from 'vitest';
import { initPhysics } from '../src/shared/physics';
import { MarbleGame } from '../src/shared/game';
import { AudioTimeline } from '../src/client/audio-timeline';
import { ChargeMotion } from '../src/client/charge-motion';

beforeAll(initPhysics);
it('only increasing power during an explicit gesture sustains charge', () => {
  const m = new ChargeMotion();
  m.move(0.3, 0);
  expect(m.level(0)).toBe(0);
  m.begin(0.2);
  expect(m.level(1)).toBe(0);
  m.move(0.4, 10);
  expect(m.level(20)).toBe(0.4);
  m.move(0.4, 70);
  expect(m.level(120)).toBe(0);
  m.move(0.6, 130);
  expect(m.level(135)).toBe(0.6);
  m.move(0.5, 140);
  expect(m.level(140)).toBe(0);
  m.move(0.55, 150);
  expect(m.level(155)).toBe(0.55);
  m.end();
  expect(m.level(156)).toBe(0);
  m.begin(0.7);
  expect(m.level(160)).toBe(0);
  m.move(NaN, 170);
  expect(m.level(170)).toBe(0);
});
it('publishes one launch only after accepted shots and consumes it at display time', () => {
  const g = new MarbleGame(0, 1, 7381);
  try {
    const timeline = new AudioTimeline();
    timeline.ingest(g.snapshot());
    const shot = {
      id: 'launch-test',
      match: 1,
      turn: 1,
      serveX: 0,
      power: 0.3,
      direction: { x: 0, z: -1 },
    };
    expect(g.shoot(1, shot).ok).toBe(false);
    expect(g.shoot(0, { ...shot, direction: { x: 0, z: 1 } }).ok).toBe(false);
    expect(g.snapshot().sounds).toEqual([]);
    g.tick(0.2);
    expect(g.shoot(0, shot).ok).toBe(true);
    const state = g.snapshot();
    expect(state.sounds).toHaveLength(1);
    expect(state.sounds![0]).toMatchObject({
      kind: 'launch',
      player: 0,
      power: 0.3,
      time: 0.2,
      position: state.balls[0].position,
    });
    expect(g.shoot(0, shot).ok).toBe(false);
    expect(g.snapshot().sounds).toHaveLength(1);
    timeline.ingest(state);
    expect(timeline.poll(0.19, true)).toEqual([]);
    expect(timeline.poll(0.2, true)).toEqual(state.sounds);
    timeline.ingest(state);
    expect(timeline.poll(0.2, true)).toEqual([]);
    const rejoin = new AudioTimeline();
    rejoin.ingest(state);
    expect(rejoin.poll(0.2, true)).toEqual([]);
    g.reset();
    expect(g.snapshot().sounds).toEqual([]);
  } finally {
    g.dispose();
  }
});
