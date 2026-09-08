import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Blender-authored surroundings. Gameplay geometry is loaded separately from shared data. */
export async function loadCourtyard(): Promise<THREE.Group> {
  const { scene } = await new GLTFLoader().loadAsync('/models/refined-courtyard.glb');
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = !object.name.includes('Compacted');
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
  materials.forEach((m) => m.dispose());
}
