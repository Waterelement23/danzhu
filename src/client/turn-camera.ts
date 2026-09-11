import type { Vec3 } from '../shared/types';

export const CAMERA_TILT = (58 * Math.PI) / 180;
const FOV_TAN = Math.tan((42 * Math.PI) / 360);
export type CameraPose = { yaw: number; distance: number; focus: Vec3 };
type ViewFrame = {
  key: string;
  phase: string;
  active: number;
  served: boolean[];
  hasPair: boolean;
};

/** Local presentation policy. Network snapshots and physical state remain untouched. */
export class TurnView {
  mode: 'overview' | 'aim' | 'shot' = 'overview';
  eligible = false;
  private key = '';
  private owner: number | null = null;
  private manualOverview = false;
  update(frame: ViewFrame, player: number | null) {
    if (this.key !== frame.key || this.owner !== player) {
      this.mode = 'overview';
      this.manualOverview = false;
      this.key = frame.key;
      this.owner = player;
    }
    this.eligible =
      player !== null &&
      player === frame.active &&
      frame.hasPair &&
      frame.served.every(Boolean) &&
      frame.phase === 'aiming';
    if (this.eligible) this.mode = this.manualOverview ? 'overview' : 'aim';
    else if (
      player !== null &&
      player === frame.active &&
      ['moving', 'finished'].includes(frame.phase) &&
      this.mode !== 'overview'
    )
      this.mode = 'shot';
    else this.mode = 'overview';
  }
  choose(aim: boolean) {
    if (!this.eligible) return;
    this.manualOverview = !aim;
    this.mode = aim ? 'aim' : 'overview';
  }
}
export function angleDelta(from: number, to: number) {
  const d = ((((to - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return Math.abs(d + Math.PI) < 1e-10 ? Math.PI : d;
}
export function cameraPosition(pose: CameraPose): Vec3 {
  const horizontal = pose.distance * Math.cos(CAMERA_TILT);
  return {
    x: pose.focus.x + Math.sin(pose.yaw) * horizontal,
    y: pose.focus.y + pose.distance * Math.sin(CAMERA_TILT),
    z: pose.focus.z + Math.cos(pose.yaw) * horizontal,
  };
}
export function fitDistance(points: Vec3[], focus: Vec3, yaw: number, aspect: number) {
  let distance = 0;
  const sy = Math.sin(yaw),
    cy = Math.cos(yaw),
    st = Math.sin(CAMERA_TILT),
    ct = Math.cos(CAMERA_TILT);
  for (const p of points) {
    const dx = p.x - focus.x,
      dy = p.y - focus.y,
      dz = p.z - focus.z;
    const horizontal = dx * cy - dz * sy,
      along = dx * sy + dz * cy;
    const depth = dy * st + along * ct,
      vertical = dy * ct - along * st;
    distance = Math.max(
      distance,
      depth + Math.abs(vertical) / (FOV_TAN * 0.78),
      depth + Math.abs(horizontal) / (FOV_TAN * Math.max(0.1, aspect) * 0.84),
    );
  }
  return distance;
}
export function pairPose(own: Vec3, other: Vec3, aspect: number, weight = 0.55): CameraPose | null {
  const dx = other.x - own.x,
    dz = other.z - own.z;
  if (
    Math.hypot(dx, dz) < 0.105 ||
    ![...Object.values(own), ...Object.values(other)].every(Number.isFinite)
  )
    return null;
  const yaw = Math.atan2(-dx, -dz);
  const focus = { x: own.x + dx * weight, y: (own.y + other.y) / 2, z: own.z + dz * weight };
  const points = [own, other].flatMap((p) =>
    [-0.22, 0.22].flatMap((x) =>
      [-0.22, 0.22].map((z) => ({ x: p.x + x, y: p.y + 0.12, z: p.z + z })),
    ),
  );
  return { yaw, focus, distance: Math.max(2.6, fitDistance(points, focus, yaw, aspect)) };
}
