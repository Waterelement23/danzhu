export const MAP_VERSION = 'courtyard-2';
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
export const ROCKS = [
  { x: -0.68, z: -0.26, radius: 0.12, height: 0.135 },
  { x: 0.68, z: 0.26, radius: 0.12, height: 0.135 },
  { x: -0.31, z: 0.88, radius: 0.075, height: 0.075 },
  { x: 0.31, z: -0.88, radius: 0.075, height: 0.075 },
];
export function terrainHeight(x: number, z: number): number {
  const edge = Math.max(0, Math.min(1, (1.28 - Math.abs(z)) / 0.3));
  const hill = (cx: number, cz: number) => Math.exp(-((x - cx) ** 2 / 0.11 + (z - cz) ** 2 / 0.18));
  return (
    0.018 +
    edge *
      (0.045 * (hill(0.52, -0.48) + hill(-0.52, 0.48)) + 0.006 * Math.cos(x * 5) * Math.cos(z * 4))
  );
}
export function makeTerrain(segments = 64, extent = CONFIG.half + 0.22) {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let z = 0; z <= segments; z++)
    for (let x = 0; x <= segments; x++) {
      const px = -extent + (x / segments) * extent * 2,
        pz = -extent + (z / segments) * extent * 2;
      vertices.push(px, terrainHeight(px, pz), pz);
    }
  for (let z = 0; z < segments; z++)
    for (let x = 0; x < segments; x++) {
      const a = z * (segments + 1) + x,
        b = a + 1,
        c = a + segments + 1,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}
export function groundNormal(x: number, z: number) {
  const d = 0.001,
    dx = (terrainHeight(x + d, z) - terrainHeight(x - d, z)) / (2 * d),
    dz = (terrainHeight(x, z + d) - terrainHeight(x, z - d)) / (2 * d);
  const n = Math.hypot(dx, 1, dz);
  return { x: -dx / n, y: 1 / n, z: -dz / n };
}
