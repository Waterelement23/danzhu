import court from './generated/court.json';
export const MAP_VERSION = court.version;
export const PROTOCOL_VERSION = 1;
export const CONFIG = {
  half: 1.5,
  radius: 0.062,
  mass: 0.012,
  serveHeight: 0.8,
  dt: 1 / 120,
  maxSpeed: 4.4,
  minSpeed: 0.22,
  aimSeconds: 30,
  maxMotion: 20,
  settleSeconds: 0.5,
  maxRounds: 20,
} as const;
export const SERVE_Z = CONFIG.half;
export const SERVE_RANGE = CONFIG.half * 0.6;
export const ROCKS = court.rocks;
export const TERRAIN_DATA = court;
export const ROCK_VERTICES = new Float32Array(court.stoneVertices.flat());
export const ROCK_INDICES = new Uint32Array(court.stoneIndices);

// Exact piecewise-linear interpolation on the very same exported triangles used by Rapier.
export function terrainHeight(x: number, z: number): number {
  const n = court.segments,
    step = (2 * court.extent) / n;
  const gx = Math.max(0, Math.min(n - 1e-9, (x + court.extent) / step));
  const gz = Math.max(0, Math.min(n - 1e-9, (z + court.extent) / step));
  const ix = Math.floor(gx),
    iz = Math.floor(gz),
    u = gx - ix,
    v = gz - iz;
  const a = iz * (n + 1) + ix,
    b = a + 1,
    c = a + n + 1,
    d = c + 1;
  const h = court.heights;
  return u + v <= 1
    ? h[a] + u * (h[b] - h[a]) + v * (h[c] - h[a])
    : h[d] + (1 - u) * (h[c] - h[d]) + (1 - v) * (h[b] - h[d]);
}
export function makeTerrain() {
  const n = court.segments,
    vertices = new Float32Array((n + 1) ** 2 * 3);
  for (let z = 0; z <= n; z++)
    for (let x = 0; x <= n; x++) {
      const i = z * (n + 1) + x;
      vertices[i * 3] = -court.extent + (x * court.extent * 2) / n;
      vertices[i * 3 + 1] = court.heights[i];
      vertices[i * 3 + 2] = -court.extent + (z * court.extent * 2) / n;
    }
  const indices = new Uint32Array(n * n * 6);
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const a = z * (n + 1) + x,
        b = a + 1,
        c = a + n + 1,
        d = c + 1;
      indices.set([a, c, b, b, c, d], (z * n + x) * 6);
    }
  return { vertices, indices };
}
export function groundNormal(x: number, z: number) {
  const d = 0.001;
  const dx = (terrainHeight(x + d, z) - terrainHeight(x - d, z)) / (2 * d);
  const dz = (terrainHeight(x, z + d) - terrainHeight(x, z - d)) / (2 * d);
  const n = Math.hypot(dx, 1, dz);
  return { x: -dx / n, y: 1 / n, z: -dz / n };
}
