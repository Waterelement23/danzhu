/** Horizontal court and courtyard layout scale relative to the authored Blender asset. */
export const COURT_SCALE = 1.1;
export type TerrainRock = { x: number; y: number; z: number; radius: number; height: number };
export type TerrainData = {
  seed: number;
  segments: number;
  extent: number;
  heights: number[];
  colors: number[][];
  rocks: TerrainRock[];
};
export function validTerrainSeed(seed: unknown): seed is number {
  return typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
}
export function nextTerrainSeed(previous = 0): number {
  const value = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return value === 0 || value === previous ? (previous + 1) >>> 0 || 1 : value;
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
function noise(seed: number, x: number, z: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    u = smooth(x - ix),
    v = smooth(z - iz);
  const hash = (a: number, b: number) => {
    let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  return (
    (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) +
    (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v
  );
}
/** Exact interpolation on the same triangle split uploaded to both Rapier and Three.js. */
export function sampleHeight(data: TerrainData, x: number, z: number): number {
  const n = data.segments,
    step = (2 * data.extent) / n;
  const gx = Math.max(0, Math.min(n - 1e-9, (x + data.extent) / step));
  const gz = Math.max(0, Math.min(n - 1e-9, (z + data.extent) / step));
  const ix = Math.floor(gx),
    iz = Math.floor(gz),
    u = gx - ix,
    v = gz - iz;
  const a = iz * (n + 1) + ix,
    b = a + 1,
    c = a + n + 1,
    d = c + 1,
    h = data.heights;
  return u + v <= 1
    ? h[a] + u * (h[b] - h[a]) + v * (h[c] - h[a])
    : h[d] + (1 - u) * (h[c] - h[d]) + (1 - v) * (h[b] - h[d]);
}
export function generateTerrain(seed: number): TerrainData {
  if (!validTerrainSeed(seed)) throw new Error('Invalid terrain seed');
  const random = seededRandom(seed),
    between = (a: number, b: number) => a + (b - a) * random();
  const n = 256,
    extent = 1.72;
  const mounds = Array.from({ length: 4 }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * between(0.24, 0.76),
    z: (i < 2 ? -1 : 1) * between(0.25, 0.73),
    rx: between(0.38, 0.58),
    rz: between(0.34, 0.57),
    height: between(0.065, 0.1),
  }));
  const hollows = Array.from({ length: 9 }, () => ({
    x: between(-1.15, 1.15),
    z: between(-1.05, 1.05),
    r: between(0.08, 0.18),
    depth: between(0.003, 0.011),
  }));
  const data: TerrainData = { seed, segments: n, extent, heights: [], colors: [], rocks: [] };
  for (let iz = 0; iz <= n; iz++)
    for (let ix = 0; ix <= n; ix++) {
      const x = -extent + (ix * 2 * extent) / n,
        z = -extent + (iz * 2 * extent) / n;
      const edge = smooth((1.46 - Math.abs(x)) / 0.26) * smooth((1.2 - Math.abs(z)) / 0.25);
      let macro = 0;
      for (const m of mounds)
        macro += m.height * Math.exp(-(((x - m.x) / m.rx) ** 2 + ((z - m.z) / m.rz) ** 2));
      let wear = 0;
      for (const h of hollows)
        wear -= h.depth * Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (h.r * h.r));
      const grain =
        0.0018 * noise(seed + 11, x * 55, z * 55) + 0.0008 * noise(seed + 29, x * 97, z * 97);
      const h = Math.fround(
        0.018 +
          edge * Math.max(-0.009, macro + wear + grain + 0.003 * noise(seed + 3, x * 8, z * 8)),
      );
      data.heights.push(h);
      const mottling =
        noise(seed + 71, x * 9, z * 9) * 0.018 + noise(seed + 137, x * 68, z * 68) * 0.013;
      const dry = Math.min(0.045, macro * 0.2);
      data.colors.push([
        0.37 + dry + mottling,
        0.235 + dry * 0.8 + mottling * 0.72,
        0.105 + dry * 0.48 + mottling * 0.36,
        1,
      ]);
    }
  // A clear entry strip is shared by both players. Rejection spacing prevents overlapping rocks.
  for (const [count, lo, hi] of [
    [4 + Math.floor(random() * 3), 0.065, 0.115],
    [32, 0.014, 0.028],
    [105, 0.005, 0.012],
  ]) {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = between(-1.3, 1.3),
          z = between(-1.16, 1.12),
          radius = between(lo, hi);
        if (data.rocks.some((r) => Math.hypot(x - r.x, z - r.z) < radius + r.radius + 0.025))
          continue;
        data.rocks.push({
          x,
          y: sampleHeight(data, x, z),
          z,
          radius,
          height: radius * between(0.45, 0.95),
        });
        break;
      }
    }
  }
  return scaleTerrainLayout(data);
}

/** Preserve stone size and surface height while widening the court and all placement coordinates. */
export function scaleTerrainLayout(data: TerrainData): TerrainData {
  return {
    ...data,
    extent: data.extent * COURT_SCALE,
    rocks: data.rocks.map((rock) => ({
      ...rock,
      x: rock.x * COURT_SCALE,
      z: rock.z * COURT_SCALE,
    })),
  };
}
