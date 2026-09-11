import { expect, it } from 'vitest';
import {
  TurnView,
  OVERVIEW_TILT,
  overviewDistance,
  pairPose,
  cameraPosition,
  angleDelta,
  fitDistance,
} from '../src/client/turn-camera';
import { touchAim, touchTravel, touchViewLimit } from '../src/client/match-ui';
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

it.each([
  [390, 770],
  [844, 312],
])('leaves room for a full drag on %sx%s', (width, height) => {
  const travel = touchTravel(width, height);
  const limit = touchViewLimit(width, height);
  const own = { x: -1.4, y: 0.05, z: 1.5 },
    other = { x: 1.5, y: 0.08, z: -1.4 };
  const p = pairPose(own, other, width / height, 0.55, limit)!;
  const eye = cameraPosition(p),
    camera = new PerspectiveCamera(42, width / height, 0.1, 60);
  camera.position.set(eye.x, eye.y, eye.z);
  camera.lookAt(p.focus.x, p.focus.y, p.focus.z);
  camera.updateMatrixWorld();
  const point = new Vector3(own.x, own.y, own.z).project(camera);
  expect(((1 + point.y) * height) / 2).toBeGreaterThan(travel + 24);
  expect(touchAim(0, travel, travel).power).toBe(1);
  expect(touchAim(2, 2, travel).power).toBe(0);
  expect(touchAim(0, 0, travel).power).toBe(0);
});

it.each([390 / 770, 844 / 316, 1440 / 850])(
  'moves the overview closer at 58 degrees while keeping the court and serve visible (%s)',
  (aspect) => {
    const focus = { x: 0, y: 0.05, z: 0 };
    const distance = overviewDistance(aspect, focus);
    const eye = cameraPosition({ yaw: 0, distance, focus, tilt: OVERVIEW_TILT });
    const camera = new PerspectiveCamera(42, aspect, 0.1, 60);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(focus.x, focus.y, focus.z);
    camera.updateMatrixWorld();
    expect((Math.atan2(eye.y - focus.y, eye.z) * 180) / Math.PI).toBeCloseTo(58);
    // Compare with the previous conservative high box using the original 58-degree angle.
    let previous = 0;
    const tan = Math.tan((42 * Math.PI) / 360),
      sin = Math.sin(OVERVIEW_TILT),
      cos = Math.cos(OVERVIEW_TILT);
    for (const x of [-1.81, 1.81])
      for (const z of [-1.81, 1.81])
        for (const y of [0, 0.88]) {
          const depth = (y - focus.y) * sin + z * cos;
          previous = Math.max(
            previous,
            depth + Math.abs((y - focus.y) * cos - z * sin) / (tan * 0.94),
            depth + Math.abs(x) / (tan * aspect * 0.94),
          );
        }
    expect(distance).toBeLessThan(previous * 0.95);
    for (const x of [-1.65, 0, 1.65])
      for (const z of [-1.65, 0, 1.65])
        for (const y of [0, 0.15]) {
          const p = new Vector3(x, y, z).project(camera);
          expect(Math.abs(p.x)).toBeLessThan(0.94);
          expect(Math.abs(p.y)).toBeLessThan(0.94);
        }
    for (const x of [-1.04, 0, 1.04]) {
      const p = new Vector3(x, 0.88, 1.7).project(camera);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.940001);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(0.940001);
    }
  },
);
