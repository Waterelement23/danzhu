import { beforeAll, it, expect } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { initPhysics, MarblePhysics } from '../src/shared/physics';
import { CONFIG, makeTerrain, terrainHeight, ROCKS, TERRAIN_DATA } from '../src/shared/map';
beforeAll(initPhysics);
const fade = (v: number) => {
  const t = Math.max(0, Math.min(1, (1.35 - Math.abs(v)) / 0.35));
  return t * t * (3 - 2 * t);
};
function relief(x: number, z: number, kind: 'groove' | 'grain') {
  const f = fade(x) * fade(z);
  if (kind === 'grain')
    return (
      f *
      0.0022 *
      (0.5 + 0.5 * Math.sin(x * 127 + Math.sin(z * 47))) *
      (0.5 + 0.5 * Math.cos(z * 113 - x * 17))
    );
  const path = -0.22 + 0.17 * Math.sin(z * 3.3);
  return (
    f * (-0.016 * Math.exp(-(((x - path) / 0.044) ** 2)) * Math.exp(-(((z + 0.12) / 0.84) ** 6)))
  );
}
function fixture(remove?: 'groove' | 'grain') {
  const p = new MarblePhysics();
  const colliders: RAPIER.Collider[] = [];
  p.world.forEachCollider((c) => colliders.push(c));
  colliders.forEach((c) => p.world.removeCollider(c, false));
  const data = makeTerrain();
  if (remove)
    for (let i = 0; i < data.vertices.length; i += 3)
      data.vertices[i + 1] -= relief(data.vertices[i], data.vertices[i + 2], remove);
  p.world.createCollider(
    RAPIER.ColliderDesc.trimesh(data.vertices, data.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setFriction(0.55)
      .setRestitution(0.32),
  );
  return p;
}
it('exported surface, ray contacts and spawn heights agree through groove and grain locations', () => {
  const p = fixture();
  p.world.step();
  for (const [x, z] of [
    [-0.22, 0],
    [0.7, -0.15],
    [-0.3, 0.17],
    [0.13, -0.72],
    [0.9, 1.5],
  ]) {
    const ray = new RAPIER.Ray({ x, y: 2, z }, { x: 0, y: -1, z: 0 });
    const hit = p.world.castRayAndGetNormal(ray, 3, true)!;
    expect(hit).not.toBeNull();
    expect(2 - hit.timeOfImpact).toBeCloseTo(terrainHeight(x, z), 5);
  }
  expect(TERRAIN_DATA.heights).toHaveLength(193 * 193);
  p.dispose();
});
for (const kind of ['groove', 'grain'] as const)
  it(`${kind} geometry changes a marble trajectory compared with removing just that relief`, () => {
    const states = [];
    for (const remove of [undefined, kind]) {
      const p = fixture(remove);
      const x = kind === 'groove' ? -0.43 : 0.8,
        z = kind === 'groove' ? 0 : -0.15;
      p.addBall(
        0,
        { x, y: terrainHeight(x, z) + CONFIG.radius + 0.008, z },
        { x: 0.45, y: 0, z: 0.08 },
      );
      for (let i = 0; i < 96; i++) p.step(CONFIG.dt, 10, 0);
      states.push(p.states()[0].position);
      p.dispose();
    }
    const difference = Math.hypot(
      states[0].x - states[1].x,
      states[0].y - states[1].y,
      states[0].z - states[1].z,
    );
    expect(difference).toBeGreaterThan(kind === 'groove' ? 0.001 : 0.0001);
  });
it('a small exported stone deflects the ball compared with the same court without it', () => {
  const r = ROCKS[4],
    out = [];
  for (const include of [true, false]) {
    const p = new MarblePhysics();
    if (!include) {
      const colliders: RAPIER.Collider[] = [];
      p.world.forEachCollider((c) => colliders.push(c));
      p.world.removeCollider(colliders[5], false);
    }
    const x = r.x - 0.16,
      z = r.z + r.radius * 0.5;
    p.addBall(0, { x, y: terrainHeight(x, z) + CONFIG.radius + 0.004, z }, { x: 0.65, y: 0, z: 0 });
    for (let i = 0; i < 60; i++) p.step(CONFIG.dt, 10, 0);
    out.push(p.states()[0].position);
    p.dispose();
  }
  expect(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y, out[0].z - out[1].z)).toBeGreaterThan(
    0.002,
  );
});
