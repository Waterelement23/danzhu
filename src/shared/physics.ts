import RAPIER from '@dimforge/rapier3d-compat';
import { courtyardCollision } from './courtyard-collision';
import {
  CONFIG,
  DEFAULT_TERRAIN,
  type TerrainData,
  makeTerrain,
  terrainHeight,
  groundNormal,
  SERVE_Z,
  shotSpeed,
} from './map';
import { ROCK_VERTICES } from './map';
import type { BallState, ImpactSound, Player, Result, Vec3 } from './types';
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
  private stones = new Set<number>();
  private audioContacts = new Set<string>();
  private lastSound = new Map<string, number>();
  private audioClock = 0;
  private impacts: Omit<ImpactSound, 'id'>[] = [];
  takeImpacts() {
    const impacts = this.impacts;
    this.impacts = [];
    return impacts;
  }
  readonly terrain: TerrainData;
  /** Build at world creation, so the decisive frame never pauses to prepare collision geometry. */
  private buildCourtyard() {
    for (const mesh of courtyardCollision()) {
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          mesh.vertices,
          mesh.indices,
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        )
          .setFriction(mesh.stone ? 0.45 : 0.55)
          .setRestitution(mesh.stone ? 0.5 : 0.32),
      );
      if (mesh.stone) this.stones.add(collider.handle);
    }
  }
  constructor(options: { flat?: boolean; restitution?: number; terrain?: TerrainData } = {}) {
    this.flat = !!options.flat;
    this.terrain = options.terrain ?? DEFAULT_TERRAIN;
    this.world = new RAPIER.World({ x: 0, y: -CONFIG.gravity, z: 0 });
    this.world.integrationParameters.maxCcdSubsteps = 4;
    if (this.flat)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(20, 0.1, 20)
          .setTranslation(0, -0.1, 0)
          .setFriction(0.5)
          .setRestitution(options.restitution ?? 0.38),
      );
    else {
      const terrain = makeTerrain(this.terrain);
      this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(
          terrain.vertices,
          terrain.indices,
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        )
          .setFriction(0.55)
          .setRestitution(0.32),
      );
      for (const rock of this.terrain.rocks) {
        const vertices = ROCK_VERTICES.map((v, i) => v * (i % 3 === 1 ? rock.height : rock.radius));
        const desc = RAPIER.ColliderDesc.convexHull(vertices);
        if (desc)
          this.stones.add(
            this.world.createCollider(
              desc.setTranslation(rock.x, rock.y, rock.z).setFriction(0.45).setRestitution(0.5),
            ).handle,
          );
      }
      this.buildCourtyard();
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
        (this.flat ? 0 : terrainHeight(x, SERVE_Z, this.terrain)) +
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
            : groundNormal(pos.x, pos.z, this.terrain)
          : this.supportNormal(body);
    if (!n) return false;
    const dot = direction.x * n.x + direction.z * n.z;
    const tangent = { x: direction.x - n.x * dot, y: -n.y * dot, z: direction.z - n.z * dot };
    const norm = length(tangent);
    if (norm < 0.00001) return false;
    const speed = shotSpeed(power);
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
  states(withSupport = true): BallState[] {
    return [...this.bodies].map(([player, b]) => {
      const n = withSupport ? this.supportNormal(b) : null;
      const v = b.linvel();
      const normalSpeed = n ? v.x * n.x + v.y * n.y + v.z * n.z : 0;
      const grounded = !!n && Math.abs(normalSpeed) < 0.2;
      return {
        player,
        position: { ...b.translation() },
        rotation: { ...b.rotation() },
        velocity: { ...v },
        grounded,
        rollingSpeed: grounded ? Math.sqrt(Math.max(0, length(v) ** 2 - normalSpeed ** 2)) : 0,
      };
    });
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
  /** Inspect every manifold, including a pair announced earlier at speculative separation.
   * Adjudication uses resolved contact before audio volume/cooldown filtering.
   */
  private collectContacts(before: BallState[], offset: number, h: number): boolean {
    let marbleContact = false;
    this.audioClock += h;
    const touching = new Set<string>();
    for (const ball of before) {
      const collider = this.bodies.get(ball.player)!.collider(0);
      this.world.contactPairsWith(collider, (other) => {
        const otherPlayer = this.colliders.get(other.handle);
        if (otherPlayer !== undefined && ball.player > otherPlayer) return;
        const key = [collider.handle, other.handle].sort((a, b) => a - b).join(':');
        let speed = 0,
          actual = false;
        this.world.contactPair(collider, other, (m, flipped) => {
          const n = m.normal(),
            sign = flipped ? -1 : 1;
          const v = before.find((b) => b.player === otherPlayer)?.velocity ?? { x: 0, y: 0, z: 0 };
          const after = this.bodies.get(ball.player)!.linvel();
          const otherAfter =
            otherPlayer === undefined
              ? { x: 0, y: 0, z: 0 }
              : this.bodies.get(otherPlayer)!.linvel();
          const approach =
            sign *
            ((ball.velocity.x - v.x) * n.x +
              (ball.velocity.y - v.y) * n.y +
              (ball.velocity.z - v.z) * n.z);
          // CCD can discard solver impulses after resolving a trimesh contact.
          // Use the measured velocity response (gravity removed) as corroboration.
          const response =
            sign *
            ((after.x - otherAfter.x - ball.velocity.x + v.x) * n.x +
              (after.y -
                otherAfter.y -
                ball.velocity.y +
                v.y +
                (otherPlayer === undefined ? CONFIG.gravity * h : 0)) *
                n.y +
              (after.z - otherAfter.z - ball.velocity.z + v.z) * n.z);
          for (let i = 0; i < m.numContacts(); i++) {
            if (
              m.contactDist(i) > 0.000005 &&
              m.contactImpulse(i) <= 1e-8 &&
              !(m.contactDist(i) < 0.03 && response < -0.04)
            )
              continue;
            actual = true;
            speed = Math.max(speed, approach);
          }
        });
        if (!actual) return;
        if (otherPlayer !== undefined) marbleContact = true;
        touching.add(key);
        if (
          this.audioContacts.has(key) ||
          speed < 0.12 ||
          this.audioClock - (this.lastSound.get(key) ?? -Infinity) < 0.055
        )
          return;
        this.lastSound.set(key, this.audioClock);
        this.impacts.push({
          time: offset,
          player: ball.player,
          position: { ...this.bodies.get(ball.player)!.translation() },
          speed,
          kind:
            otherPlayer !== undefined
              ? 'marble'
              : this.stones.has(other.handle)
                ? 'stone'
                : 'earth',
        });
        // Preview/direct-physics callers need not consume this optional event stream.
        if (this.impacts.length > 64) this.impacts.shift();
      });
    }
    this.audioContacts = touching;
    return marbleContact;
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
      const before = this.states(false);
      const remaining = first ? Math.max(0, first.time + EPS_TIME - elapsed) : dt - elapsed;
      if (remaining < 1e-10) return first;
      const adjudicate = options?.adjudicate !== false;
      let sensitive =
        adjudicate &&
        before.some(
          (b) =>
            bound - Math.max(Math.abs(b.position.x), Math.abs(b.position.z)) <
            length(b.velocity) * remaining + 0.002,
        );
      if (adjudicate && before.length === 2) {
        const a = before[0],
          b = before[1];
        // Refine an imminent relative sweep, not mere proximity. Two nearby
        // parallel/separating balls must not force 128 full terrain solves.
        // Equal gravity cancels in relative motion. Re-evaluate after every
        // ordinary substep so terrain-induced changes can refine the next one.
        const end = (ball: BallState): Vec3 => ({
          x: ball.position.x + ball.velocity.x * remaining,
          y: ball.position.y + ball.velocity.y * remaining,
          z: ball.position.z + ball.velocity.z * remaining,
        });
        sensitive ||= sweep(a.position, end(a), b.position, end(b)) !== null;
      }
      if (first) sensitive = true; // Preserve the 0.1ms simultaneous-result window.
      const h = Math.min(remaining, sensitive ? CONFIG.dt / 128 : CONFIG.dt / 2);
      this.resistance(h);
      this.world.timestep = h;
      this.world.step(this.queue);
      // A collision-start event can precede actual response; later solver contact
      // must still count even when CCD leaves a positive geometric separation.
      this.queue.drainCollisionEvents(() => {});
      const contact = this.collectContacts(before, elapsed + h, h);
      const after = this.states(false);
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
