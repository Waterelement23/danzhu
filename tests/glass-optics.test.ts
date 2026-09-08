import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { refract, fresnel, traceGlassSphere, sampleGlassPhotons } from '../src/client/glass-optics';

it('obeys Snell’s law at an air/glass interface', () => {
  const incoming = new Vector3(0.5, -Math.sqrt(0.75), 0);
  const outgoing = refract(incoming, new Vector3(0, 1, 0), 1 / 1.52)!;
  expect(outgoing.length()).toBeCloseTo(1, 12);
  expect(outgoing.x * 1.52).toBeCloseTo(incoming.x, 12);
  expect(fresnel(1, 1, 1.52)).toBeCloseTo(((1.52 - 1) / (1.52 + 1)) ** 2, 12);
  expect(refract(new Vector3(Math.sqrt(0.75), -0.5, 0), new Vector3(0, 1, 0), 1.52)).toBeNull();
});
it('tracks two refractions and loses energy through reflection and absorption', () => {
  const ray = traceGlassSphere(new Vector3(0, 1, 0), new Vector3(0, -1, 0), 1, 1.52)!;
  expect(ray.exit.y).toBeCloseTo(-1, 10);
  expect(ray.length).toBeCloseTo(2, 10);
  expect(ray.direction.y).toBeCloseTo(-1, 10);
  expect(ray.transmission).toBeCloseTo((1 - fresnel(1, 1, 1.52)) ** 2, 10);
  const photons = sampleGlassPhotons(
    new Vector3(0, 1, 0),
    1,
    1.52,
    new Vector3(0.5, 0.8, 1),
    2,
    1024,
  );
  const flux = photons.reduce((s, p) => s.add(p.flux), new Vector3());
  expect(flux.x).toBeGreaterThan(0);
  expect(flux.x).toBeLessThan(flux.y);
  expect(flux.y).toBeLessThan(flux.z);
  expect(flux.z).toBeLessThan(Math.PI);
});
it('converges paraxial rays near the ball-lens focal distance, then diverges', () => {
  const x = 0.01,
    r = 1,
    ior = 1.52;
  const ray = traceGlassSphere(
    new Vector3(x, Math.sqrt(r * r - x * x), 0),
    new Vector3(0, -1, 0),
    r,
    ior,
  )!;
  const t = -ray.exit.x / ray.direction.x;
  const focus = ray.exit.clone().addScaledVector(ray.direction, t);
  expect(-focus.y).toBeCloseTo((ior * r) / (2 * (ior - 1)), 3);
  expect(ray.exit.clone().addScaledVector(ray.direction, 2 * t).x).toBeLessThan(0);
});
it('rotating the incident sun rotates the optical paths, without inventing extra flux', () => {
  const down = sampleGlassPhotons(
    new Vector3(0, 1, 0),
    0.062,
    1.52,
    new Vector3(1, 1, 1),
    0.1,
    1024,
  );
  const side = sampleGlassPhotons(
    new Vector3(1, 1, 0).normalize(),
    0.062,
    1.52,
    new Vector3(1, 1, 1),
    0.1,
    1024,
  );
  expect(side[0].entry.x).not.toBeCloseTo(down[0].entry.x, 3);
  expect(side.reduce((s, p) => s + p.flux.x, 0)).toBeCloseTo(
    down.reduce((s, p) => s + p.flux.x, 0),
    10,
  );
});

import { BoxGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, Ray, Scene, Vector4 } from 'three';
import { OpticalScene, depositPhotons } from '../src/client/marble-caustics';
it('deposits conserve transmitted flux when a focus is filtered into a texture', () => {
  const flux = new Vector3(0.001, 0.002, 0.003),
    bounds = new Vector4(-0.1, -0.1, 0.2, 0.2);
  const data = depositPhotons(
    [{ point: new Vector3(0, 0.04, 0), flux, distance: 0.1 }],
    bounds,
    64,
  );
  const integral = new Vector3();
  for (let i = 0; i < data.length; i += 4)
    integral.add(new Vector3(data[i], data[i + 1], data[i + 2]).multiplyScalar((0.2 / 64) ** 2));
  expect(integral.distanceTo(flux)).toBeLessThan(1e-9);
});
it('light hits the raised receiver first and opaque geometry blocks incoming sunlight', () => {
  const scene = new Scene();
  const floor = new Mesh(new PlaneGeometry(4, 4), new MeshBasicMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = true;
  scene.add(floor);
  const stone = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial());
  stone.position.y = 0.1;
  stone.castShadow = true;
  scene.add(stone);
  const optical = new OpticalScene(scene);
  const hit = optical.intersect(new Ray(new Vector3(0, 1, 0), new Vector3(0, -1, 0)))!;
  expect(hit.point.y).toBeCloseTo(0.2, 6);
  expect(optical.intersect(new Ray(new Vector3(0, 0.1, 0), new Vector3(0, 1, 0)))).toBeTruthy();
  expect(
    optical.intersect(new Ray(new Vector3(0.5, 0.1, 0), new Vector3(0, 1, 0))),
  ).toBeUndefined();
  optical.dispose();
});

import { makeMarble } from '../src/client/marble';
import { MarbleCaustics } from '../src/client/marble-caustics';
it('does not create a glowing caustic when the marble is shaded by a roof', () => {
  const scene = new Scene();
  const floor = new Mesh(new PlaneGeometry(6, 6), new MeshBasicMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = true;
  scene.add(floor);
  const ball = makeMarble(0);
  ball.position.y = 0.062;
  scene.add(ball);
  const caustics = new MarbleCaustics(ball.children[0] as Mesh);
  caustics.setScene(scene);
  caustics.update([ball, undefined]);
  expect(caustics.stats.deposits).toBeGreaterThan(100);
  const roof = new Mesh(new BoxGeometry(3, 0.05, 3), new MeshBasicMaterial());
  roof.position.y = 0.4;
  roof.castShadow = true;
  scene.add(roof);
  caustics.setScene(scene);
  caustics.update([ball, undefined]);
  expect(caustics.stats.deposits).toBe(0);
  caustics.dispose();
});
