import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { courtyardBuffer, courtyardUrl, releaseCourtyardBuffer } from './startup-assets';
import { startupStage } from './startup';

/** Blender-authored surroundings. Gameplay geometry is loaded separately from shared data. */
export async function loadCourtyard(): Promise<THREE.Group> {
  const buffer = await courtyardBuffer();
  startupStage('正在布置院落');
  const { scene } = await new GLTFLoader().parseAsync(buffer, new URL('.', courtyardUrl()).href);
  releaseCourtyardBuffer();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const glazing = materials.some((m) => m.name.includes('Smoky reflective glass'));
    object.castShadow = !object.name.includes('Compacted') && !glazing;
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial)
        for (const texture of [material.map, material.normalMap, material.roughnessMap])
          if (texture) texture.anisotropy = 4;
    }
    object.receiveShadow = true;
  });
  return scene;
}
export function disposeCourtyard(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(material);
  });
  geometries.forEach((g) => g.dispose());
  disposeMaterialTextures(materials);
  materials.forEach((m) => m.dispose());
}

/** glTF fabric images are owned by the loaded scene and must be released on leave/retry. */
export function disposeMaterialTextures(materials: Iterable<THREE.Material>) {
  const textures = new Set<THREE.Texture>();
  for (const material of materials)
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture && !value.isRenderTargetTexture) textures.add(value);
  textures.forEach((texture) => texture.dispose());
}
