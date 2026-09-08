import { expect, it } from 'vitest';
import { Ray, Triangle, Vector3 } from 'three';
import { TriangleBVH } from '../src/client/triangle-bvh';

it('agrees with exhaustive triangle intersections for nearest hits and shadow rays', () => {
  let seed = 71;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32) * 4 - 2;
  const vertices = Float32Array.from({ length: 300 * 9 }, random);
  const index = new TriangleBVH(vertices);
  for (let i = 0; i < 160; i++) {
    const ray = new Ray(
      new Vector3(random(), random(), random()),
      new Vector3(random(), random(), random()).normalize(),
    );
    const limit = i % 2 ? 0.5 : Infinity;
    let best = limit;
    const a = new Vector3(),
      b = new Vector3(),
      c = new Vector3(),
      p = new Vector3();
    for (let j = 0; j < vertices.length; j += 9) {
      a.fromArray(vertices, j);
      b.fromArray(vertices, j + 3);
      c.fromArray(vertices, j + 6);
      if (!ray.intersectTriangle(a, b, c, false, p)) continue;
      const distance = p.distanceTo(ray.origin);
      if (distance > 0.00001 && distance < best) best = distance;
    }
    const hit = index.intersect(ray, limit);
    expect(!!index.intersect(ray, limit, true)).toBe(best < limit);
    if (best < limit) expect(hit?.distance).toBeCloseTo(best, 8);
    else expect(hit).toBeUndefined();
  }
  expect(index.stats.triangles).toBe(300);
  expect(index.stats.nodes).toBeLessThan(600);
});
it('handles empty, overlapping and degenerate geometry without runaway subdivision', () => {
  expect(new TriangleBVH(new Float32Array()).intersect(new Ray())).toBeUndefined();
  const vertices = Float32Array.from(
    Array.from({ length: 1000 }, () => [-1, 0, -1, 1, 0, -1, 0, 0, 1]).flat(),
  );
  const index = new TriangleBVH(vertices);
  expect(index.stats.nodes).toBe(1);
  const hit = index.intersect(new Ray(new Vector3(0, 1, 0), new Vector3(0, -1, 0)));
  expect(hit?.distance).toBe(1);
  expect(
    hit?.normal.equals(
      Triangle.getNormal(
        new Vector3(-1, 0, -1),
        new Vector3(1, 0, -1),
        new Vector3(0, 0, 1),
        new Vector3(),
      ),
    ),
  ).toBe(true);
  index.dispose();
  expect(index.intersect(new Ray())).toBeUndefined();
});
