import { performance } from 'node:perf_hooks';
import { MarblePhysics, initPhysics } from '../src/shared/physics';
import { CONFIG, createTerrain, terrainHeight } from '../src/shared/map';

await initPhysics();
const terrain = createTerrain(7381);
const results = [];
for (const [name, gap, adjudicate] of [
  ['far', 0.4, true],
  ['near-parallel', 0.002, true],
  ['near-after-result', 0.002, false],
] as const) {
  const p = new MarblePhysics({ terrain });
  const positions = [0, 1].map((i) => ({
    x: i * (2 * CONFIG.radius + gap),
    y: terrainHeight(i * (2 * CONFIG.radius + gap), 1.48, terrain) + CONFIG.radius,
    z: 1.48,
  }));
  p.addBall(0, positions[0]);
  p.addBall(1, positions[1]);
  let substeps = 0;
  const step = p.world.step.bind(p.world);
  p.world.step = (...args) => {
    substeps++;
    return step(...args);
  };
  const samples: number[] = [];
  let calls = 0;
  for (let i = 0; i < 100; i++) {
    for (const player of [0, 1] as const) {
      p.bodies.get(player)!.setTranslation(positions[player], true);
      p.bodies.get(player)!.setLinvel({ x: 0, y: 0, z: -0.3 }, true);
    }
    substeps = 0;
    const start = performance.now();
    p.step(CONFIG.dt, CONFIG.half, 0, { adjudicate });
    if (i >= 20) {
      samples.push(performance.now() - start);
      calls += substeps;
    }
    p.takeImpacts();
  }
  samples.sort((a, b) => a - b);
  results.push({
    name,
    substeps: calls / samples.length,
    medianMs: samples[40],
    p95Ms: samples[76],
  });
  p.dispose();
}
console.log(JSON.stringify(results, null, 2));
