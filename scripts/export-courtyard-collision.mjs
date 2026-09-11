import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Matrix4, Quaternion, Vector3 } from 'three';

// Extract collision triangles from the rendered Blender GLB; no hand-drawn proxy floors.
// Keep solid surfaces reachable by an outgoing marble. Leaves and stitching are soft decoration.
const source = readFileSync(new URL('../public/models/refined-courtyard.glb', import.meta.url));
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const binary = source.subarray(28 + jsonLength);
function accessor(index) {
  const a = gltf.accessors[index],
    view = gltf.bufferViews[a.bufferView];
  const size = { SCALAR: 1, VEC3: 3 }[a.type];
  const bytes = { 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  if (!size || !bytes || a.sparse) throw new Error('Unsupported collision accessor');
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const read = { 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE' }[a.componentType];
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length: size }, (_, j) =>
      binary[read](start + i * (view.byteStride ?? size * bytes) + j * bytes),
    ),
  );
}
function pack(values, signed) {
  const b = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => (signed ? b.writeInt16LE(v, i * 2) : b.writeUInt16LE(v, i * 2)));
  return b.toString('base64');
}
const meshes = [];
function visit(index, parent = new Matrix4()) {
  const node = gltf.nodes[index];
  const local = node.matrix
    ? new Matrix4().fromArray(node.matrix)
    : new Matrix4().compose(
        new Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
        new Vector3().fromArray(node.scale ?? [1, 1, 1]),
      );
  const world = parent.clone().multiply(local);
  if (node.mesh !== undefined && !/Leaf|seam cord/.test(node.name)) {
    const positions = [],
      indices = [],
      unique = new Map();
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4)
        throw new Error('Expected triangles');
      const points = accessor(primitive.attributes.POSITION).map((p) =>
        new Vector3().fromArray(p).applyMatrix4(world),
      );
      const elements = accessor(primitive.indices).flat();
      for (let i = 0; i < elements.length; i += 3) {
        const triangle = elements.slice(i, i + 3).map((j) => points[j]);
        const low = Math.min(...triangle.map((p) => p.y));
        if (low > (/Tree bark/.test(node.name) ? 0.4 : 1.25)) continue;
        if (
          ['x', 'z'].some(
            (axis) =>
              Math.min(...triangle.map((p) => p[axis])) > 4.8 ||
              Math.max(...triangle.map((p) => p[axis])) < -4.8,
          )
        )
          continue;
        for (const p of triangle) {
          // At most 0.125 mm rounding error, far below the 50 mm marble radius.
          const rounded = p.toArray().map((n) => Math.round(n * 4000));
          const key = rounded.join(',');
          if (!unique.has(key)) {
            unique.set(key, positions.length / 3);
            positions.push(...rounded);
          }
          indices.push(unique.get(key));
        }
      }
    }
    if (indices.length)
      meshes.push({
        name: node.name,
        vertices: pack(positions, true),
        indices: pack(indices, false),
        triangles: indices.length / 3,
      });
  }
  for (const child of node.children ?? []) visit(child, world);
}
for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node);
const result = {
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  units: 'unscaled glTF metres, Y up; little-endian int16 coordinates and uint16 indices',
  precision: 4000,
  meshes,
};
writeFileSync(
  new URL('../src/shared/generated/courtyard-collision.json', import.meta.url),
  JSON.stringify(result),
);
console.log(
  JSON.stringify({
    meshes: meshes.length,
    triangles: meshes.reduce((sum, m) => sum + m.triangles, 0),
  }),
);
