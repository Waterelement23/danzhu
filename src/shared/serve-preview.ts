import RAPIER from '@dimforge/rapier3d-compat';
import { MarblePhysics, initPhysics } from './physics';
import { CONFIG, SERVE_Z, terrainHeight, shotSpeed } from './map';
import type { Vec3 } from './types';
export type ServeFlight = {
  points: Vec3[];
  end: Vec3;
  kind: 'ground' | 'stone' | 'out';
  time: number;
};

/** Only the first airborne leg. A swept sphere queries the exact shared court colliders. */
export class ServePredictor {
  private readonly physics = new MarblePhysics();
  private readonly sphere = new RAPIER.Ball(CONFIG.radius);
  private readonly terrainHandle: number;
  static async create() {
    await initPhysics();
    return new ServePredictor();
  }
  private constructor() {
    const handles: number[] = [];
    this.physics.world.forEachCollider((c) => handles.push(c.handle));
    this.terrainHandle = handles[0];
    this.physics.world.step(); // Populate spatial queries for the immutable static court.
  }
  predict(
    x: number,
    direction: { x: number; z: number },
    power: number,
    bound: number,
  ): ServeFlight {
    const speed = shotSpeed(Math.max(0, Math.min(1, power)));
    const norm = Math.hypot(direction.x, direction.z) || 1;
    const vx = (direction.x / norm) * speed,
      vz = (direction.z / norm) * speed;
    const origin: Vec3 = { x, y: terrainHeight(x, SERVE_Z) + CONFIG.serveHeight, z: SERVE_Z };
    const position = (t: number): Vec3 => ({
      x: x + vx * t,
      y: origin.y - (CONFIG.gravity * t * t) / 2,
      z: SERVE_Z + vz * t,
    });
    const points: Vec3[] = [origin];
    let exitTime = Infinity;
    for (const [p, v] of [
      [x, vx],
      [SERVE_Z, vz],
    ]) {
      if (Math.abs(p) > bound + 1e-8) exitTime = 0;
      else if (v !== 0)
        exitTime = Math.min(exitTime, Math.max(0, ((v > 0 ? bound : -bound) - p) / v));
    }
    const dt = CONFIG.dt / 2;
    for (let t = 0; t < 1; t += dt) {
      const endTime = Math.min(t + dt, exitTime),
        a = position(t),
        b = position(endTime);
      const delta = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const hit = this.physics.world.castShape(
        a,
        { x: 0, y: 0, z: 0, w: 1 },
        delta,
        this.sphere,
        0,
        1,
        true,
      );
      if (hit) {
        const time = t + (endTime - t) * hit.time_of_impact,
          centre = position(time);
        points.push(centre);
        const contact = hit.collider.projectPoint(centre, false);
        if (!contact) throw new Error('Cannot locate first contact');
        return {
          points,
          end: contact.point,
          kind: hit.collider.handle === this.terrainHandle ? 'ground' : 'stone',
          time,
        };
      }
      points.push(b);
      if (endTime >= exitTime) return { points, end: b, kind: 'out', time: exitTime };
    }
    // The normal standing serve reaches this court in under a second.
    throw new Error('No first contact found for standing serve');
  }
  dispose() {
    this.physics.dispose();
  }
}
