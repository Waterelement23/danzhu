import * as THREE from 'three';
import { TriangleBVH } from './triangle-bvh';
import { CONFIG, terrainHeight } from '../shared/map';
import {
  GLASS_IOR,
  GLASS_ABSORPTION_DISTANCE,
  glassTint,
  sampleGlassPhotons,
  SUN_DIRECTION,
} from './glass-optics';

/** Static triangle acceleration for actual ground, stones, buildings and foliage. */
export class OpticalScene {
  private tree: TriangleBVH;
  readonly stats: TriangleBVH['stats'];
  constructor(root: THREE.Object3D, accept = (mesh: THREE.Mesh) => mesh.castShadow) {
    const start = performance.now();
    root.updateWorldMatrix(true, true);
    const meshes: THREE.Mesh[] = [];
    let vertexCount = 0;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !accept(object)) return;
      meshes.push(object);
      vertexCount += object.geometry.index?.count ?? object.geometry.getAttribute('position').count;
    });
    const vertices = new Float32Array(vertexCount * 3),
      point = new THREE.Vector3();
    let offset = 0;
    for (const mesh of meshes) {
      const geometry = mesh.geometry,
        positions = geometry.getAttribute('position'),
        index = geometry.index;
      for (let i = 0; i < (index?.count ?? positions.count); i++) {
        point
          .fromBufferAttribute(positions, index ? index.getX(i) : i)
          .applyMatrix4(mesh.matrixWorld);
        point.toArray(vertices, offset);
        offset += 3;
      }
    }
    this.tree = new TriangleBVH(vertices);
    this.stats = { ...this.tree.stats, buildMs: performance.now() - start };
  }
  intersect(ray: THREE.Ray, maxDistance = Infinity, anyHit = false) {
    return this.tree.intersect(ray, maxDistance, anyHit);
  }
  dispose() {
    this.tree.dispose();
  }
}

export type PhotonDeposit = { point: THREE.Vector3; flux: THREE.Vector3; distance: number };
const SIZE = 128;
const EPSILON = 0.00005;

/** Normalized splats: filtering changes concentration, never creates light energy. */
export function depositPhotons(
  deposits: PhotonDeposit[],
  bounds: THREE.Vector4,
  size = SIZE,
  heightAt = terrainHeight,
) {
  const data = new Float32Array(size * size * 4),
    weights = new Float32Array(size * size);
  const dx = bounds.z / size,
    dz = bounds.w / size;
  for (const deposit of deposits) {
    const x = (deposit.point.x - bounds.x) / dx - 0.5,
      z = (deposit.point.z - bounds.y) / dz - 0.5;
    // Pixel reconstruction plus the finite solar disk (0.266 degree angular radius).
    const sigma = Math.max(
      1.5,
      (Math.tan((0.266 * Math.PI) / 180) * deposit.distance) / Math.max(dx, dz),
    );
    const radius = Math.ceil(2.5 * sigma);
    const cells: [number, number][] = [];
    let total = 0;
    for (
      let j = Math.max(0, Math.floor(z) - radius);
      j <= Math.min(size - 1, Math.ceil(z) + radius);
      j++
    ) {
      for (
        let i = Math.max(0, Math.floor(x) - radius);
        i <= Math.min(size - 1, Math.ceil(x) + radius);
        i++
      ) {
        const w = Math.exp(-((i - x) ** 2 + (j - z) ** 2) / (2 * sigma * sigma));
        cells.push([j * size + i, w]);
        total += w;
      }
    }
    if (!total) continue;
    for (const [pixel, weight] of cells) {
      const w = weight / total,
        offset = pixel * 4,
        irradiance = w / (dx * dz);
      data[offset] += deposit.flux.x * irradiance;
      data[offset + 1] += deposit.flux.y * irradiance;
      data[offset + 2] += deposit.flux.z * irradiance;
      data[offset + 3] += deposit.point.y * w;
      weights[pixel] += w;
    }
  }
  for (let i = 0; i < weights.length; i++)
    data[i * 4 + 3] = weights[i]
      ? data[i * 4 + 3] / weights[i]
      : heightAt(bounds.x + ((i % size) + 0.5) * dx, bounds.y + (Math.floor(i / size) + 0.5) * dz);
  return data;
}

function makeFields(size: number, compactCount: number) {
  return [0, 1].map((player) => {
    const tint = glassTint(player);
    const texture = new THREE.DataTexture(
      new Float32Array(size * size * 4),
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return {
      texture,
      bounds: new THREE.Vector4(0, 0, 1, 1),
      center: new THREE.Vector4(0, -100, 0, 0),
      key: '',
      photons: sampleGlassPhotons(
        SUN_DIRECTION,
        CONFIG.radius,
        GLASS_IOR,
        new THREE.Vector3(tint.r, tint.g, tint.b),
        GLASS_ABSORPTION_DISTANCE,
        compactCount * 3,
      ),
      compactPhotons: sampleGlassPhotons(
        SUN_DIRECTION,
        CONFIG.radius,
        GLASS_IOR,
        new THREE.Vector3(tint.r, tint.g, tint.b),
        GLASS_ABSORPTION_DISTANCE,
        compactCount,
      ),
    };
  });
}

export class MarbleCaustics {
  private world?: OpticalScene;
  private ribbon: OpticalScene;
  private fields: ReturnType<typeof makeFields>;
  private size: number;
  private materials = new WeakSet<THREE.MeshStandardMaterial>();
  private heightAt = terrainHeight;
  private uniforms: Record<string, { value: unknown }>;
  readonly stats = { photons: 0, deposits: 0, updateMs: 0 };
  constructor(ribbon: THREE.Mesh, budget?: { size: number; photons: number }) {
    this.size = budget?.size ?? SIZE;
    this.fields = makeFields(this.size, budget?.photons ?? 512);
    // The ribbon is authored in unit-ball coordinates. Rotation is applied to rays at runtime.
    const copy = new THREE.Mesh(ribbon.geometry);
    this.ribbon = new OpticalScene(copy, () => true);
    this.uniforms = {
      opticalSun: { value: SUN_DIRECTION },
      opticalTexel: { value: 1 / this.size },
      opticalBalls: { value: this.fields.map((f) => f.center) },
      opticalMap0: { value: this.fields[0].texture },
      opticalMap1: { value: this.fields[1].texture },
      opticalBounds0: { value: this.fields[0].bounds },
      opticalBounds1: { value: this.fields[1].bounds },
    };
  }
  setScene(scene: THREE.Scene, heightAt = terrainHeight) {
    this.heightAt = heightAt;
    this.world?.dispose();
    this.world = new OpticalScene(scene);
    for (const field of this.fields) {
      field.key = '';
      field.center.set(0, -100, 0, 0);
      field.texture.image.data?.fill(0);
      field.texture.needsUpdate = true;
    }
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.receiveShadow) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || this.materials.has(material))
          continue;
        if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) continue;
        this.materials.add(material);
        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, this.uniforms);
          shader.vertexShader = 'varying vec3 vOpticalWorld;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\nvOpticalWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
          );
          shader.fragmentShader = GLSL + shader.fragmentShader;
          const lighting = THREE.ShaderChunk.lights_fragment_begin.replace(
            'getDirectionalLightInfo( directionalLight, directLight );',
            'getDirectionalLightInfo( directionalLight, directLight );\ndirectLight.color *= opticalVisibility(vOpticalWorld);',
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_fragment_begin>',
            lighting,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
            #if NUM_DIR_LIGHTS > 0
              vec3 photonEnergy = opticalIrradiance(opticalMap0, opticalBounds0, opticalBalls[0]) + opticalIrradiance(opticalMap1, opticalBounds1, opticalBalls[1]);
              vec3 worldNormal = inverseTransformDirection(geometryNormal, viewMatrix);
              reflectedLight.directDiffuse += photonEnergy * max(0.0, worldNormal.y) * directionalLights[0].color * material.diffuseColor * RECIPROCAL_PI;
            #endif`,
          );
        };
        material.customProgramCacheKey = () => 'marble-photon-caustics-v1';
        material.needsUpdate = true;
      }
    });
  }
  update(marbles: (THREE.Object3D | undefined)[], camera?: THREE.Camera, viewportHeight = 1000) {
    if (!this.world) return;
    const started = performance.now();
    let updated = false;
    const positions = marbles.map((marble) => marble?.getWorldPosition(new THREE.Vector3()));

    for (let i = 0; i < 2; i++) {
      const field = this.fields[i],
        marble = marbles[i];
      if (!marble) {
        field.center.w = 0;
        field.key = '';
        continue;
      }
      const center = positions[i]!;
      const rotation = marble.getWorldQuaternion(new THREE.Quaternion());
      field.center.set(center.x, center.y, center.z, CONFIG.radius);
      const depth = camera ? -center.clone().applyMatrix4(camera.matrixWorldInverse).z : 0;
      const pixelRadius = camera
        ? (CONFIG.radius * viewportHeight * camera.projectionMatrix.elements[5]) / (2 * depth)
        : Infinity;
      const photons = pixelRadius > 48 ? field.photons : field.compactPhotons;
      const key = [
        ...center.toArray(),
        ...rotation.toArray(),
        photons.length,
        ...(positions[1 - i]?.toArray() ?? []),
      ].join(',');
      if (field.key === key) continue;
      field.key = key;
      if (!updated) this.stats.photons = this.stats.deposits = 0;
      updated = true;
      const inverse = rotation.clone().invert(),
        deposits: PhotonDeposit[] = [];
      const otherSphere = positions[1 - i]
        ? new THREE.Sphere(positions[1 - i], CONFIG.radius)
        : undefined;
      const otherPoint = new THREE.Vector3();
      for (const photon of photons) {
        this.stats.photons++;
        const entry = photon.entry.clone().add(center).addScaledVector(SUN_DIRECTION, EPSILON);
        const inside = new THREE.Ray(
          photon.entry.clone().divideScalar(CONFIG.radius).applyQuaternion(inverse),
          photon.inside.clone().applyQuaternion(inverse),
        );
        if (this.ribbon.intersect(inside, photon.length / CONFIG.radius, true)) continue;
        const incoming = new THREE.Ray(entry, SUN_DIRECTION);
        if (otherSphere && incoming.intersectSphere(otherSphere, otherPoint)) continue;
        if (this.world.intersect(incoming, Infinity, true)) continue;
        const exit = photon.exit.clone().add(center).addScaledVector(photon.direction, EPSILON);
        const outgoing = new THREE.Ray(exit, photon.direction);
        const hit = this.world.intersect(outgoing, 4);
        if (
          otherSphere &&
          outgoing.intersectSphere(otherSphere, otherPoint) &&
          otherPoint.distanceTo(exit) < (hit?.distance ?? Infinity)
        )
          continue;
        if (!hit || hit.normal.y < 0.15) continue;
        deposits.push({ point: hit.point, flux: photon.flux, distance: hit.distance });
      }
      this.stats.deposits += deposits.length;
      // Resolve the near caustic instead of letting rare grazing rays consume the atlas.
      // Far transmitted flux is omitted, never redistributed into the near highlight.
      const footprint = Math.max(CONFIG.radius * 3, Math.abs(center.y) * 1.2);
      const groundAxis = center.clone().addScaledVector(SUN_DIRECTION, -center.y / SUN_DIRECTION.y);
      const localDeposits = deposits.filter(
        (d) =>
          Math.abs(d.point.x - groundAxis.x) < footprint &&
          Math.abs(d.point.z - groundAxis.z) < footprint,
      );
      const box = new THREE.Box3();
      for (const deposit of localDeposits) box.expandByPoint(deposit.point);
      if (!localDeposits.length) box.set(center.clone(), center.clone());
      box.expandByScalar(0.012);
      field.bounds.set(
        box.min.x,
        box.min.z,
        Math.max(0.04, box.max.x - box.min.x),
        Math.max(0.04, box.max.z - box.min.z),
      );
      field.texture.image.data = depositPhotons(
        localDeposits,
        field.bounds,
        this.size,
        this.heightAt,
      );
      field.texture.needsUpdate = true;
    }
    if (updated) this.stats.updateMs = performance.now() - started;
  }
  dispose() {
    this.world?.dispose();
    this.ribbon.dispose();
    for (const field of this.fields) field.texture.dispose();
    this.materials = new WeakSet();
  }
}
const GLSL = `
varying vec3 vOpticalWorld;
uniform vec3 opticalSun;
uniform float opticalTexel;
uniform vec4 opticalBalls[2];
uniform sampler2D opticalMap0, opticalMap1;
uniform vec4 opticalBounds0, opticalBounds1;
float opticalVisibility(vec3 p) {
  float visibility = 1.0;
  for (int i = 0; i < 2; i++) {
    vec3 delta = opticalBalls[i].xyz - p;
    float t = dot(delta, opticalSun), radius = opticalBalls[i].w;
    if (radius > 0.0 && t > 0.0) {
      float separation = length(delta - t * opticalSun);
      float penumbra = max(0.0006, t * 0.00465);
      visibility *= smoothstep(radius - penumbra, radius + penumbra, separation);
    }
  }
  return visibility;
}
vec3 opticalIrradiance(sampler2D map, vec4 bounds, vec4 ball) {
  vec2 uv = (vOpticalWorld.xz - bounds.xy) / bounds.zw;
  if (ball.w == 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec3(0.0);
  vec4 sampleEnergy = texture2D(map, uv);
  // Reject photons landing on a different height (e.g. stone top versus soil below).
  float tolerance = max(0.003, max(bounds.z, bounds.w) * opticalTexel * 2.0);
  float surface = 1.0 - smoothstep(tolerance, tolerance * 2.0, abs(vOpticalWorld.y - sampleEnergy.a));
  return sampleEnergy.rgb * surface;
}
`;
