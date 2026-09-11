import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** One shared reflection plane behind the four frames: one extra view, not four. */
export function makeDoorReflection(size = 768) {
  const reflection = new Reflector(new THREE.PlaneGeometry(3.905, 1.82), {
    textureWidth: size,
    textureHeight: size,
    multisample: 0,
    clipBias: 0.001,
    color: 0xffffff,
    shader: {
      uniforms: {
        color: { value: new THREE.Color() },
        tDiffuse: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
      },
      vertexShader: `uniform mat4 textureMatrix;
        varying vec4 reflectionUv;varying vec3 worldPoint;varying vec3 worldNormal;
        void main(){reflectionUv=textureMatrix*vec4(position,1.0);
          worldPoint=(modelMatrix*vec4(position,1.0)).xyz;
          worldNormal=normalize(mat3(modelMatrix)*normal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform sampler2D tDiffuse;uniform vec3 color;
        varying vec4 reflectionUv;varying vec3 worldPoint;varying vec3 worldNormal;
        void main(){vec3 reflected=texture2DProj(tDiffuse,reflectionUv).rgb;
          float facing=abs(dot(normalize(cameraPosition-worldPoint),normalize(worldNormal)));
          float fresnel=.045+.955*pow(1.0-facing,5.0);
          gl_FragColor=vec4(reflected*vec3(.94,1.0,.97),fresnel);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  reflection.name = 'Glazing planar courtyard reflection';
  reflection.rotation.y = Math.PI / 2;
  reflection.position.set(-2.572, 1.11, -0.45);
  const material = reflection.material as THREE.ShaderMaterial;
  material.transparent = true;
  material.depthWrite = false;
  reflection.renderOrder = 2;
  // The garden is static. Reuse its projection until the camera changes, and
  // refresh small moving reflections at 10 Hz. Never recursively update during
  // transmission or cube-probe passes through a different camera.
  const drawReflection = reflection.onBeforeRender;
  let cameraKey = '',
    lastUpdate = -Infinity,
    dirty = true,
    dynamic = false;
  let mainCamera: THREE.Camera | undefined;
  reflection.onBeforeRender = function (renderer, scene, camera, ...args) {
    if (mainCamera && mainCamera !== camera) return;
    mainCamera = camera;
    const key = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]
      .map((v) => v.toFixed(5))
      .join(',');
    const now = performance.now();
    if (!dirty && key === cameraKey && (!dynamic || now - lastUpdate < 100)) return;
    dirty = false;
    cameraKey = key;
    lastUpdate = now;
    drawReflection.call(this, renderer, scene, camera, ...args);
  };
  return Object.assign(reflection, {
    invalidate() {
      dirty = true;
    },
    setDynamic(value: boolean) {
      if (dynamic && !value) dirty = true;
      dynamic = value;
    },
  });
}
