import { beforeAll, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/shared/map';
import { initPhysics, MarblePhysics } from '../src/shared/physics';

beforeAll(initPhysics);
it.each(['parallel', 'separating', 'finished'] as const)(
  'keeps nearby %s balls within the ordinary physics work budget',
  (scenario) => {
    const p = new MarblePhysics({ flat: true });
    try {
      p.addBall(0, { x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -0.3 });
      p.addBall(
        1,
        { x: 2 * CONFIG.radius + 0.002, y: 0.5, z: 0 },
        {
          x: scenario === 'separating' ? 0.3 : 0,
          y: 0,
          z: -0.3,
        },
      );
      const step = vi.spyOn(p.world, 'step');
      const result = p.step(CONFIG.dt, CONFIG.half, 0, { adjudicate: scenario !== 'finished' });
      expect(result).toBeNull();
      expect(step.mock.calls.length).toBeLessThanOrEqual(4);
      expect(p.states()[0].position.z).toBeLessThan(0);
    } finally {
      p.dispose();
    }
  },
);
