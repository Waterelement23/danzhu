import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import data from '../src/shared/generated/courtyard-collision.json';
import { courtyardCollision } from '../src/shared/courtyard-collision';

it('uses collision data exported from the currently rendered courtyard', () => {
  const source = readFileSync(new URL('../public/models/refined-courtyard.glb', import.meta.url));
  expect(data.sourceSha256).toBe(createHash('sha256').update(source).digest('hex'));
  const geometry = courtyardCollision();
  expect(geometry).toBe(courtyardCollision());
  for (const mesh of geometry) {
    expect(mesh.vertices.every(Number.isFinite)).toBe(true);
    expect(mesh.indices.every((i) => i < mesh.vertices.length / 3)).toBe(true);
  }
});
