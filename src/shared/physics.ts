import RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG, ROCKS, makeTerrain, terrainHeight, groundNormal, SERVE_Z } from './map';
import { ROCK_VERTICES } from './rock-shape';
import type { BallState, Player, Result, Vec3 } from './types';
let initialization: Promise<void> | undefined;
export function initPhysics() {
  return (initialization ??= RAPIER.init());
}
const EPS_TIME = 0.0001;
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
function crossing(a: Vec3, b: Vec3, bound: number): number | null {
  let t = Infinity;
  for (const key of ['x', 'z'] as const)
    for (const side of [-1, 1]) {
      const start = a[key] * side,
        end = b[key] * side;
      if (start <= bound + 1e-8 && end > bound && end > start)
        t = Math.min(t, (bound - start) / (end - start));
    }
  return Number.isFinite(t) ? Math.max(0, t) : null;
}
function sweep(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number | null {
  const px = a.x - c.x,
    py = a.y - c.y,
    pz = a.z - c.z;
  const vx = b.x - a.x - (d.x - c.x),
    vy = b.y - a.y - (d.y - c.y),
    vz = b.z - a.z - (d.z - c.z);
  const radius = 2 * CONFIG.radius + 0.000002;
  const C = px * px + py * py + pz * pz - radius * radius;
  if (C <= 0) return 0;
  const A = vx * vx + vy * vy + vz * vz,
    B = 2 * (px * vx + py * vy + pz * vz),
    disc = B * B - 4 * A * C;
  if (A < 1e-20 || disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}
export class MarblePhysics {
  readonly world: RAPIER.World;
  readonly bodies = new Map<Player, RAPIER.RigidBody>();
  private queue = new RAPIER.EventQueue(true);
  private colliders = new Map<number, Player>();
  private flat: boolean;
  constructor(options: { flat?: boolean; restitution?: number } = {}) {
    this.flat = !!options.flat;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.integrationParameters.maxCcdSubsteps = 4;
    if (this.flat)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(20, 0.1, 20)
          .setTranslation(0, -0.1, 0)
          .setFriction(0.5)
          .setRestitution(options.restitution ?? 0.38),
      );
    else {
      const terrain = makeTerrain();
      this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          terrain.vertices,
          terrain.indices,
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        )
          .setFriction(0.55)
          .setRestitution(0.32),
      );
      for (const rock of ROCKS) {
        const vertices = ROCK_VERTICES.map((v, i) => v * (i % 3 === 1 ? rock.height : rock.radius));
        const desc = RAPIER.ColliderDesc.convexHull(vertices);
        if (desc)
          this.world.createCollider(
            desc
              .setTranslation(rock.x, terrainHeight(rock.x, rock.z), rock.z)
              .setFriction(0.45)
              .setRestitution(0.5),
          );
      }
    }
  }
  addBall(player: Player, position: Vec3, velocity: Vec3 = { x: 0, y: 0, z: 0 }) {
    if (this.bodies.has(player)) throw new Error('弹珠已经入场');
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinvel(velocity.x, velocity.y, velocity.z)
        .setCcdEnabled(true),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(CONFIG.radius)
        .setMass(CONFIG.mass)
        .setFriction(0.5)
        .setRestitution(0.6)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    this.bodies.set(player, body);
    this.colliders.set(collider.handle, player);
    return body;
  }
  serve(
    player: Player,
    x: number,
    standing: boolean,
    direction: { x: number; z: number },
    power: number,
  ) {
    this.addBall(player, {
      x,
      y:
        (this.flat ? 0 : terrainHeight(x, SERVE_Z)) +
        (standing ? CONFIG.serveHeight : CONFIG.radius + 0.0001),
      z: SERVE_Z,
    });
    this.strike(player, direction, power, standing, true);
  }
  strike(
    player: Player,
    direction: { x: number; z: number },
    power: number,
    standing = false,
    initial = false,
  ): boolean {
    const body = this.bodies.get(player)!;
    const pos = body.translation(),
      n = standing
        ? { x: 0, y: 1, z: 0 }
        : initial
          ? this.flat
            ? { x: 0, y: 1, z: 0 }
            : groundNormal(pos.x, pos.z)
          : this.supportNormal(body);
    if (!n) return false;
    const dot = direction.x * n.x + direction.z * n.z;
    const tangent = { x: direction.x - n.x * dot, y: -n.y * dot, z: direction.z - n.z * dot };
    const norm = length(tangent);
    if (norm < 0.00001) return false;
    const speed = CONFIG.minSpeed + power * (CONFIG.maxSpeed - CONFIG.minSpeed);
    body.wakeUp();
    body.applyImpulse(
      {
        x: (tangent.x / norm) * speed * CONFIG.mass,
        y: (tangent.y / norm) * speed * CONFIG.mass,
        z: (tangent.z / norm) * speed * CONFIG.mass,
      },
      true,
    );
    return true;
  }
  states(): BallState[] {
    return [...this.bodies].map(([player, b]) => ({
      player,
      position: { ...b.translation() },
      rotation: { ...b.rotation() },
      velocity: { ...b.linvel() },
    }));
  }
  private supportNormal(body: RAPIER.RigidBody): Vec3 | null {
    let best: Vec3 | null = null;
    this.world.contactPairsWith(body.collider(0), (other) => {
      if (this.colliders.has(other.handle)) return;
      this.world.contactPair(body.collider(0), other, (manifold) => {
        const raw = manifold.normal(),
          sign = raw.y < 0 ? -1 : 1;
        const n = { x: raw.x * sign, y: raw.y * sign, z: raw.z * sign };
        for (let i = 0; i < manifold.numContacts(); i++)
          if (manifold.contactDist(i) < 0.0015 && n.y > 0.35 && (!best || n.y > best.y)) best = n;
      });
    });
    return best;
  }
  private supported(body: RAPIER.RigidBody) {
    return (
      !!this.supportNormal(body) && Math.abs(body.linvel().y) < 0.15 && body.translation().y > -1
    );
  }
  settled() {
    return [...this.bodies.values()].every(
      (b) => this.supported(b) && length(b.linvel()) < 0.018 && length(b.angvel()) < 0.5,
    );
  }
  private resistance(dt: number) {
    for (const body of this.bodies.values()) {
      if (body.isSleeping() || !this.supported(body)) continue;
      const v = body.linvel(),
        speed = Math.hypot(v.x, v.z),
        w = body.angvel();
      const factor = speed > 0.001 ? Math.max(0, 1 - (0.42 * dt) / speed) : 0;
      body.setLinvel({ x: v.x * factor, y: v.y, z: v.z * factor }, false);
      const wFactor = Math.max(0, 1 - 1.8 * dt);
      body.setAngvel({ x: w.x * wFactor, y: w.y * wFactor, z: w.z * wFactor }, false);
    }
  }
  /** Continuous swept candidates select microsteps near hits/bounds; timing resolution <0.1 ms. */
  step(
    dt: number,
    bound: number,
    active: Player,
    options?: { ignoreInitialOutside?: boolean; adjudicate?: boolean },
  ): Result | null {
    let elapsed = 0,
      first: Result | null = null;
    while (elapsed < Math.max(dt, first ? first.time + EPS_TIME : 0) - 1e-10) {
      const before = this.states();
      const remaining = first ? Math.max(0, first.time + EPS_TIME - elapsed) : dt - elapsed;
      if (remaining < 1e-10) return first;
      let sensitive = before.some(
        (b) =>
          bound - Math.max(Math.abs(b.position.x), Math.abs(b.position.z)) <
          length(b.velocity) * remaining + 0.002,
      );
      if (before.length === 2) {
        const a = before[0],
          b = before[1];
        sensitive ||=
          Math.hypot(
            a.position.x - b.position.x,
            a.position.y - b.position.y,
            a.position.z - b.position.z,
          ) <
          2 * CONFIG.radius + (length(a.velocity) + length(b.velocity)) * remaining + 0.004;
      }
      const h = Math.min(remaining, sensitive ? CONFIG.dt / 128 : CONFIG.dt / 2);
      this.resistance(h);
      this.world.timestep = h;
      this.world.step(this.queue);
      let contact = false;
      this.queue.drainCollisionEvents((a, b, started) => {
        if (started && this.colliders.has(a) && this.colliders.has(b)) {
          this.world.contactPair(this.world.getCollider(a), this.world.getCollider(b), (m) => {
            for (let i = 0; i < m.numContacts(); i++)
              if (m.contactDist(i) <= 0.000005) contact = true;
          });
        }
      });
      const after = this.states();
      const events: Result[] = [];
      for (let i = 0; i < before.length; i++) {
        const t = crossing(before[i].position, after[i].position, bound);
        if (t !== null)
          events.push({
            winner: (1 - before[i].player) as Player,
            reason: 'out',
            time: elapsed + t * h,
          });
      }
      if (before.length === 2) {
        const t = sweep(
          before[0].position,
          after[0].position,
          before[1].position,
          after[1].position,
        );
        if (t !== null || contact)
          events.push({ winner: active, reason: 'hit', time: elapsed + (t ?? 1) * h });
      }
      if (events.length && options?.adjudicate !== false) {
        events.sort((a, b) => a.time - b.time);
        first ??= events[0];
        if (events.some((e) => e.time - first!.time <= EPS_TIME && e.winner !== first!.winner))
          return { winner: null, reason: 'draw', time: first.time };
      }
      elapsed += h;
      if (first && elapsed >= first.time + EPS_TIME - 1e-10) return first;
    }
    return first;
  }
  dispose() {
    this.queue.free();
    this.world.free();
  }
}
