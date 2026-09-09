import * as THREE from 'three';
import { seededRandom } from '../shared/terrain-generator';

/** Mineral colour only: all relief and grains remain in the shared collision mesh. */
export function makeSoilMaterial(seed: number) {
  const size = 256,
    random = seededRandom(seed ^ 0x52f79a),
    pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const mineral = random(),
      tone = Math.round(237 + (mineral - 0.5) * 24);
    pixels.set([tone, tone, tone, 255], i * 4);
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, map });
}
