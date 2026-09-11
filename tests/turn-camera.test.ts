import { expect, it } from 'vitest';
import {
  TurnView,
  pairPose,
  cameraPosition,
  angleDelta,
  fitDistance,
} from '../src/client/turn-camera';
import { touchAim } from '../src/client/match-ui';
import { PerspectiveCamera, Vector3 } from 'three';

const frame = {
  key: '1:1:3',
  phase: 'aiming' as const,
  active: 0,
  served: [true, true],
  hasPair: true,
};
it('only the current player gets an aiming view and both entry serves stay fixed', () => {
  const view = new TurnView();
  view.update({ ...frame, served: [false, false] }, 0);
  expect(view.mode).toBe('overview');
  view.update({ ...frame, served: [true, false], active: 1 }, 1);
  expect(view.mode).toBe('overview');
  view.update(frame, 1);
  expect(view.mode).toBe('overview');
  view.update(frame, 0);
  expect(view.mode).toBe('aim');
});
it('holds the shot, respects manual overview, and resets on the next turn or disconnect', () => {
  const view = new TurnView();
  view.update(frame, 0);
  view.update({ ...frame, phase: 'moving' }, 0);
  expect(view.mode).toBe('shot');
  view.update({ ...frame, phase: 'finished' }, 0);
  expect(view.mode).toBe('shot');
  view.update({ ...frame, key: '1:1:4', active: 1 }, 0);
  expect(view.mode).toBe('overview');
  view.update(frame, 0);
  view.choose(false);
  view.update(frame, 0);
  expect(view.mode).toBe('overview');
  view.update({ ...frame, key: '1:1:5' }, 0);
  expect(view.mode).toBe('aim');
  view.update({ ...frame, key: '1:1:5' }, null);
  expect(view.mode).toBe('overview');
});
it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])(
  'aligns camera and screen drag at yaw %s',
  (yaw) => {
    const own = { x: 0, y: 0.06, z: 0 },
      other = { x: -Math.sin(yaw), y: 0.07, z: -Math.cos(yaw) };
    const pose = pairPose(own, other, 0.6)!;
    expect(angleDelta(yaw, pose.yaw)).toBeCloseTo(0);
    const p = cameraPosition(pose);
    expect(
      Math.atan2(p.y - pose.focus.y, Math.hypot(p.x - pose.focus.x, p.z - pose.focus.z)),
    ).toBeCloseTo((58 * Math.PI) / 180);
    const drag = touchAim(0, 60, 120, yaw);
    expect(drag.direction.x).toBeCloseTo(other.x);
    expect(drag.direction.z).toBeCloseTo(other.z);
    expect(drag.power).toBe(0.5);
  },
);
it('takes the shortest rotation and handles degenerate pairs', () => {
  expect(angleDelta((179 * Math.PI) / 180, (-179 * Math.PI) / 180)).toBeCloseTo(
    (2 * Math.PI) / 180,
  );
  expect(angleDelta(0, -Math.PI)).toBe(Math.PI);
  expect(pairPose({ x: 0, y: 0, z: 0 }, { x: 0.001, y: 0, z: 0 }, 1)).toBeNull();
});
it.each([0.45, 1, 2.2])('fits distant balls inside the safe view at aspect %s', (aspect) => {
  const a = { x: -1.6, y: 0.06, z: 1.6 },
    b = { x: 1.6, y: 0.09, z: -1.6 };
  const p = pairPose(a, b, aspect)!;
  expect(p.distance).toBeGreaterThanOrEqual(fitDistance([a, b], p.focus, p.yaw, aspect));
  const eye = cameraPosition(p),
    camera = new PerspectiveCamera(42, aspect, 0.1, 60);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(p.focus.x, p.focus.y, p.focus.z);
  camera.updateMatrixWorld();
  const projected = [a, b].map((v) => new Vector3(v.x, v.y, v.z).project(camera));
  expect(projected[0].y).toBeLessThan(projected[1].y);
  for (const point of projected) {
    expect(Math.abs(point.x)).toBeLessThan(0.84);
    expect(Math.abs(point.y)).toBeLessThan(0.78);
  }
});
