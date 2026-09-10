import court from './generated/court.json';
import {
  generateTerrain,
  sampleHeight,
  scaleTerrainLayout,
  COURT_SCALE,
  type TerrainData,
} from './terrain-generator';
export { nextTerrainSeed, validTerrainSeed, type TerrainData } from './terrain-generator';
export { COURT_SCALE } from './terrain-generator';
export const MAP_VERSION = 'seeded-earth-2';
export const PROTOCOL_VERSION = 4;
export const CONFIG = {
  half: 1.5 * COURT_SCALE,
  radius: 0.05,
  mass: 0.012,
  serveHeight: 0.8,
  dt: 1 / 120,
  gravity: 9.81,
  maxSpeed: 4.4,
  minSpeed: 0.22,
  aimSeconds: 30,
  maxMotion: 20,
  settleSeconds: 0.5,
  maxRounds: 20,
} as const;
export const SERVE_Z = CONFIG.half;
export const SERVE_RANGE = CONFIG.half * 0.6;
// Historical seed-0 fixture only. Active matches receive their own TerrainData.
export const DEFAULT_TERRAIN: TerrainData = scaleTerrainLayout({ ...court, seed: 0 });
export const ROCKS = DEFAULT_TERRAIN.rocks;
export const TERRAIN_DATA = DEFAULT_TERRAIN;
export const ROCK_VERTICES = new Float32Array(court.stoneVertices.flat());
export const ROCK_INDICES = new Uint32Array(court.stoneIndices);

export function createTerrain(seed: number): TerrainData {
  return seed === 0 ? DEFAULT_TERRAIN : generateTerrain(seed);
}
export function terrainHeight(x: number, z: number, data = DEFAULT_TERRAIN): number {
  return sampleHeight(data, x, z);
}
export function makeTerrain(data = DEFAULT_TERRAIN) {
  const n = data.segments,
    vertices = new Float32Array((n + 1) ** 2 * 3);
  for (let z = 0; z <= n; z++)
    for (let x = 0; x <= n; x++) {
      const i = z * (n + 1) + x;
      vertices[i * 3] = -data.extent + (x * data.extent * 2) / n;
      vertices[i * 3 + 1] = data.heights[i];
      vertices[i * 3 + 2] = -data.extent + (z * data.extent * 2) / n;
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
export function groundNormal(x: number, z: number, data = DEFAULT_TERRAIN) {
  const d = 0.001;
  const dx = (terrainHeight(x + d, z, data) - terrainHeight(x - d, z, data)) / (2 * d);
  const dz = (terrainHeight(x, z + d, data) - terrainHeight(x, z - d, data)) / (2 * d);
  const n = Math.hypot(dx, 1, dz);
  return { x: -dx / n, y: 1 / n, z: -dz / n };
}

export const shotSpeed = (power: number) =>
  CONFIG.minSpeed + power * (CONFIG.maxSpeed - CONFIG.minSpeed);
