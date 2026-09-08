import { Box3, Ray, Triangle, Vector3 } from 'three';

type Node = { box: Box3; start: number; count: number; left?: Node; right?: Node };

/** Each triangle appears in one leaf. Spatially overlapping triangles are never duplicated. */
export class TriangleBVH {
  private vertices: Float32Array;
  private order: Uint32Array;
  private root?: Node;
  readonly stats: { triangles: number; nodes: number; buildMs: number };
  constructor(vertices: Float32Array) {
    const start = performance.now();
    this.vertices = vertices;
    const count = vertices.length / 9;
    this.order = Uint32Array.from({ length: count }, (_, i) => i);
    this.stats = { triangles: count, nodes: 0, buildMs: 0 };
    const centers = new Float32Array(count * 3);
    for (let i = 0; i < count; i++)
      for (let axis = 0; axis < 3; axis++) {
        const offset = i * 9 + axis;
        centers[i * 3 + axis] =
          (vertices[offset] + vertices[offset + 3] + vertices[offset + 6]) / 3;
      }
    const build = (start: number, end: number, depth: number): Node => {
      const box = new Box3(),
        centroidBox = new Box3();
      const point = new Vector3();
      for (let i = start; i < end; i++) {
        const triangle = this.order[i],
          offset = triangle * 9;
        for (let j = 0; j < 9; j += 3) box.expandByPoint(point.fromArray(vertices, offset + j));
        centroidBox.expandByPoint(point.fromArray(centers, triangle * 3));
      }
      const node: Node = { box, start, count: end - start };
      this.stats.nodes++;
      if (node.count <= 24 || depth >= 40) return node;
      const size = centroidBox.getSize(point);
      const axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
      if (size.getComponent(axis) < 1e-9) return node;
      const split = (centroidBox.min.getComponent(axis) + centroidBox.max.getComponent(axis)) / 2;
      let mid = start;
      for (let i = start; i < end; i++) {
        if (centers[this.order[i] * 3 + axis] >= split) continue;
        const previous = this.order[mid];
        this.order[mid++] = this.order[i];
        this.order[i] = previous;
      }
      if (mid === start || mid === end) return node;
      node.left = build(start, mid, depth + 1);
      node.right = build(mid, end, depth + 1);
      node.count = 0;
      return node;
    };
    if (count) this.root = build(0, count, 0);
    this.stats.buildMs = performance.now() - start;
  }
  intersect(ray: Ray, maxDistance = Infinity, anyHit = false) {
    const a = new Vector3(),
      b = new Vector3(),
      c = new Vector3(),
      point = new Vector3(),
      boxPoint = new Vector3();
    let nearest: { point: Vector3; normal: Vector3; distance: number } | undefined;
    const entry = (node: Node) => {
      if (node.box.containsPoint(ray.origin)) return 0;
      return ray.intersectBox(node.box, boxPoint) ? boxPoint.distanceTo(ray.origin) : Infinity;
    };
    const visit = (node: Node, distance: number): boolean => {
      if (distance === Infinity || distance > (nearest?.distance ?? maxDistance)) return false;
      if (node.left && node.right) {
        const left = entry(node.left),
          right = entry(node.right);
        const first = left <= right ? node.left : node.right,
          second = left <= right ? node.right : node.left;
        if (visit(first, Math.min(left, right)) && anyHit) return true;
        return visit(second, Math.max(left, right));
      }
      for (let i = node.start; i < node.start + node.count; i++) {
        const offset = this.order[i] * 9;
        a.fromArray(this.vertices, offset);
        b.fromArray(this.vertices, offset + 3);
        c.fromArray(this.vertices, offset + 6);
        if (!ray.intersectTriangle(a, b, c, false, point)) continue;
        const distance = point.distanceTo(ray.origin);
        if (distance > 0.00001 && distance < (nearest?.distance ?? maxDistance)) {
          nearest = {
            point: point.clone(),
            normal: Triangle.getNormal(a, b, c, new Vector3()),
            distance,
          };
          if (anyHit) return true;
        }
      }
      return false;
    };
    if (this.root) visit(this.root, entry(this.root));
    return nearest;
  }
  dispose() {
    this.root = undefined;
    this.vertices = new Float32Array();
    this.order = new Uint32Array();
  }
}
