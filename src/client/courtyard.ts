import * as THREE from 'three';

/** All courtyard dressing is world-space geometry outside the playable court. */
export function addCourtyard(scene: THREE.Scene) {
  const plaster = new THREE.MeshStandardMaterial({ color: 0xc7b698, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x72523a, roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x656761, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({
    color: 0x697746,
    roughness: 1,
    flatShading: true,
  });
  const box = (parent: THREE.Object3D, size: number[], pos: number[], material: THREE.Material) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(...(size as [number, number, number])),
      material,
    );
    m.position.set(...(pos as [number, number, number]));
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // A small outbuilding with a pitched roof, door and raised window frames.
  const shed = new THREE.Group();
  shed.position.set(-3.55, 0, -1.55);
  box(shed, [1.35, 1.2, 1.65], [0, 0.6, 0], plaster);
  for (const sign of [-1, 1]) {
    const slope = box(shed, [0.86, 0.07, 1.88], [sign * 0.37, 1.38, 0], roof);
    slope.rotation.z = -sign * 0.4;
  }
  box(shed, [0.44, 0.82, 0.04], [-0.2, 0.41, 0.846], wood);
  box(shed, [0.32, 0.34, 0.06], [0.39, 0.76, 0.85], wood);
  box(shed, [0.24, 0.26, 0.065], [0.39, 0.76, 0.854], roof);
  box(shed, [0.035, 0.28, 0.07], [0.39, 0.76, 0.86], wood);
  scene.add(shed);
  // A low wall frames the back of the yard without obscuring the far boundary.
  box(scene, [9, 0.55, 0.18], [0, 0.275, -3.15], plaster);
  box(scene, [9.1, 0.06, 0.24], [0, 0.58, -3.15], roof);
  for (let i = 0; i < 7; i++)
    box(scene, [0.24, 0.67, 0.26], [-4.2 + i * 1.4, 0.335, -3.15], plaster);
  const furniture = new THREE.Group();
  furniture.position.set(2.85, 0, 0.5);
  furniture.rotation.y = -0.15;
  box(furniture, [0.95, 0.07, 0.7], [0, 0.64, 0], wood);
  for (const x of [-0.37, 0.37])
    for (const z of [-0.24, 0.24]) box(furniture, [0.065, 0.61, 0.065], [x, 0.305, z], wood);
  for (const z of [-0.72, 0.72]) {
    box(furniture, [0.46, 0.055, 0.42], [0, 0.36, z], wood);
    for (const x of [-0.17, 0.17])
      for (const dz of [-0.14, 0.14])
        box(furniture, [0.045, 0.35, 0.045], [x, 0.175, z + dz], wood);
    const back = z + Math.sign(z) * 0.18;
    box(furniture, [0.46, 0.22, 0.045], [0, 0.65, back], wood);
    for (const x of [-0.17, 0.17]) box(furniture, [0.045, 0.4, 0.045], [x, 0.53, back], wood);
  }
  scene.add(furniture);
  for (const [x, z] of [
    [3.85, -1.55],
    [-2.7, 1.05],
  ]) {
    box(scene, [0.12, 0.8, 0.12], [x, 0.4, z], wood);
    for (let i = 0; i < 4; i++) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), leaves);
      crown.position.set(
        x + Math.cos(i * 2.3) * 0.2,
        0.95 + (i % 2) * 0.24,
        z + Math.sin(i * 2.3) * 0.2,
      );
      crown.scale.y = 1.2;
      crown.castShadow = crown.receiveShadow = true;
      scene.add(crown);
    }
  }
}
