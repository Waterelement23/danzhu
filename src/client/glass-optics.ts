import { Color, Vector3 } from 'three';

export const GLASS_IOR = 1.52;
export const GLASS_ABSORPTION_DISTANCE = 0.1;
export const SUN_DIRECTION = new Vector3(-3, 5, 4).normalize();
export const glassTint = (player: number) => new Color(player ? '#e4c776' : '#8dd5c5');

/** Normal faces the incident medium; direction points along light propagation. */
export function refract(direction: Vector3, normal: Vector3, eta: number): Vector3 | null {
  const cos = -direction.dot(normal);
  const k = 1 - eta * eta * (1 - cos * cos);
  return k < 0
    ? null
    : direction
        .clone()
        .multiplyScalar(eta)
        .addScaledVector(normal, eta * cos - Math.sqrt(k))
        .normalize();
}
export function fresnel(cos: number, from: number, to: number) {
  const sin2 = (from / to) ** 2 * Math.max(0, 1 - cos * cos);
  if (sin2 >= 1) return 1;
  const ct = Math.sqrt(1 - sin2);
  const rs = (from * cos - to * ct) / (from * cos + to * ct);
  const rp = (to * cos - from * ct) / (to * cos + from * ct);
  return (rs * rs + rp * rp) / 2;
}
export function traceGlassSphere(entry: Vector3, incident: Vector3, radius: number, ior: number) {
  const normal = entry.clone().divideScalar(radius);
  const inside = refract(incident, normal, 1 / ior);
  if (!inside) return null;
  const length = -2 * entry.dot(inside);
  const exit = entry.clone().addScaledVector(inside, length);
  const exitNormal = exit.clone().divideScalar(-radius);
  const direction = refract(inside, exitNormal, ior);
  if (!direction) return null;
  const transmission =
    (1 - fresnel(-incident.dot(normal), 1, ior)) * (1 - fresnel(-inside.dot(exitNormal), ior, 1));
  return { entry, inside, exit, direction, length, transmission };
}
export type GlassPhoton = NonNullable<ReturnType<typeof traceGlassSphere>> & { flux: Vector3 };

/** Equal-area deterministic aperture sampling; sum of flux cannot exceed sunlit disk area. */
export function sampleGlassPhotons(
  sun: Vector3,
  radius: number,
  ior: number,
  tint: Vector3,
  absorptionDistance: number,
  count: number,
): GlassPhoton[] {
  const axis = Math.abs(sun.y) < 0.95 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const u = new Vector3().crossVectors(sun, axis).normalize();
  const v = new Vector3().crossVectors(sun, u);
  const incident = sun.clone().negate();
  const area = (Math.PI * radius * radius) / count;
  const photons: GlassPhoton[] = [];
  for (let i = 0; i < count; i++) {
    const r = radius * Math.sqrt((i + 0.5) / count),
      phi = i * Math.PI * (3 - Math.sqrt(5));
    const entry = sun
      .clone()
      .multiplyScalar(Math.sqrt(radius * radius - r * r))
      .addScaledVector(u, r * Math.cos(phi))
      .addScaledVector(v, r * Math.sin(phi));
    const ray = traceGlassSphere(entry, incident, radius, ior);
    if (!ray) continue;
    const distance = ray.length / absorptionDistance;
    const flux = new Vector3(
      tint.x ** distance,
      tint.y ** distance,
      tint.z ** distance,
    ).multiplyScalar(area * ray.transmission);
    photons.push({ ...ray, flux });
  }
  return photons;
}
