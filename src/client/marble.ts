import * as THREE from 'three';
import ribbonData from './generated/marble-ribbon.json';
import { CONFIG } from '../shared/map';
import { GLASS_IOR, GLASS_ABSORPTION_DISTANCE, glassTint, SUN_DIRECTION } from './glass-optics';

/** Blender-authored inner ribbon; the optical outer surface matches Rapier's sphere. */
export function makeMarble(player: number, segments = 96) {
  const group = new THREE.Group();
  group.name = `glass-marble-${player}`;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(ribbonData.vertices.flat(), 3),
  );
  geometry.setIndex(ribbonData.indices);
  geometry.computeVertexNormals();
  const colors: number[] = [];
  const centre = new THREE.Color(player ? '#b94113' : '#126c9b');
  const edge = new THREE.Color(player ? '#efbc37' : '#a6d35d');
  for (const [u] of ribbonData.uv) {
    const tint = centre
      .clone()
      .lerp(edge, THREE.MathUtils.smoothstep(Math.abs(u - 0.5), 0.27, 0.49));
    colors.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ribbon = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.32,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  ribbon.scale.setScalar(CONFIG.radius);
  group.add(ribbon);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.025,
    transmission: 1,
    ior: GLASS_IOR,
    thickness: CONFIG.radius * 0.36,
    attenuationColor: glassTint(player),
    attenuationDistance: GLASS_ABSORPTION_DISTANCE,
    envMapIntensity: 1.05,
  });
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.radius, segments, Math.round((segments * 2) / 3)),
    glass,
  );
  shell.name = 'transmissive-glass-shell';
  shell.castShadow = false;
  // Direct-light occlusion and refracted flux are handled together by MarbleCaustics.
  group.add(shell);
  return group;
}

/** A single local reflection probe captures the actual courtyard, including its sky opening. */
export function captureCourtyardReflection(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const target = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const probe = new THREE.CubeCamera(0.03, 35, target);
  probe.position.set(0, 0.65, 0);
  // Procedural overcast sky with a bright sunward opening, captured by the same probe.
  // This is reflected environment radiance, not a highlight stuck to the marble surface.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(25, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { sunDirection: { value: SUN_DIRECTION } },
      vertexShader: `varying vec3 skyDirection;
      void main(){ skyDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 skyDirection; uniform vec3 sunDirection;
      float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float noise(vec3 p){ vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){vec3 d=normalize(skyDirection);
        float n=.75*noise(d*2.5)+.25*noise(d*5.0);
        float clouds=smoothstep(.38,.72,n);
        vec3 blue=mix(vec3(1.5,1.7,1.8),vec3(.65,1.0,1.55),max(0.0,d.y));
        float glow=pow(max(0.0,dot(d,sunDirection)),10.0);
        gl_FragColor=vec4(mix(blue,vec3(5.0,4.9,4.6),clouds)+vec3(3.0,2.7,2.3)*glow,1.0); }`,
    }),
  );
  scene.add(sky);
  const background = scene.background;
  scene.background = new THREE.Color('#d5e5ef');
  // Only physical scenery belongs in the probe: omit game markers and glass to avoid feedback.
  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (
      o.visible &&
      (o.name.startsWith('glass-marble-') ||
        o instanceof THREE.Line ||
        (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial))
    ) {
      hidden.push(o);
      o.visible = false;
    }
  });
  let environment: THREE.WebGLRenderTarget;
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    probe.update(renderer, scene);
    environment = pmrem.fromCubemap(target.texture);
  } finally {
    hidden.forEach((o) => (o.visible = true));
    scene.background = background;
    scene.remove(sky);
    sky.geometry.dispose();
    sky.material.dispose();
    pmrem.dispose();
    target.dispose();
  }
  return environment;
}
