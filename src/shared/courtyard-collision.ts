import data from './generated/courtyard-collision.json';
import { COURT_SCALE } from './terrain-generator';

let geometry: ReturnType<typeof decode> | undefined;
function decode() {
  const unpack = (base64: string, signed: boolean) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    return Array.from({ length: bytes.length / 2 }, (_, i) =>
      signed ? view.getInt16(i * 2, true) : view.getUint16(i * 2, true),
    );
  };
  return data.meshes.map((mesh) => ({
    stone: /stone|granite|ceramic/i.test(mesh.name),
    vertices: Float32Array.from(
      unpack(mesh.vertices, true),
      (v, i) => (v / data.precision) * (i % 3 === 1 ? 1 : COURT_SCALE),
    ),
    indices: Uint32Array.from(unpack(mesh.indices, false)),
  }));
}
/** Decode once; every room uses the same geometry as the visible GLB and court layout scale. */
export function courtyardCollision() {
  return (geometry ??= decode());
}
