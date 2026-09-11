import { pixelRatioFor, renderProfile } from './render-budget';
import {
  TurnView,
  CAMERA_TILT,
  OVERVIEW_TILT,
  overviewDistance,
  pairPose,
  cameraPosition,
  angleDelta,
  fitDistance,
  type CameraPose,
} from './turn-camera';
import { BallLabels } from './ball-labels';
import { touchAim, touchTravel, touchViewLimit } from './match-ui';
import type { AudioFrame } from './audio';
import { startupStage } from './startup';
import { makeSoilMaterial } from './soil-material';
import { ServeGuide } from './serve-guide';
import { ServeLine } from './serve-line';
import { ServeTap } from './serve-selection';
import { ReturnCancel, type DragFeedback } from './return-cancel';
import { makeDoorReflection } from './glazing';
import { makeMarble, captureCourtyardReflection } from './marble';
import { MarbleCaustics } from './marble-caustics';
import { SUN_DIRECTION } from './glass-optics';
import { loadCourtyard, disposeCourtyard, disposeMaterialTextures } from './courtyard';
import * as THREE from 'three';
import {
  CONFIG,
  COURT_SCALE,
  SERVE_RANGE,
  SERVE_Z,
  DEFAULT_TERRAIN,
  createTerrain,
  type TerrainData,
  ROCK_VERTICES,
  ROCK_INDICES,
  makeTerrain,
  terrainHeight,
} from '../shared/map';
import type { BallState, GameSnapshot } from '../shared/types';

type Direction = { x: number; z: number };
type PresentationFrame = { time: number; balls: [BallState | undefined, BallState | undefined] };
const BLUE = 0x2389b9,
  AMBER = 0xd99335;

/** Display and input only. The shared map and server snapshots own every physical surface and ball. */
export class MarbleScene {
  public readonly ready: Promise<void>;
  public readonly quality = renderProfile(matchMedia('(pointer: coarse)').matches);
  private get marblesMoving() {
    return !!this.snapshot?.balls.some(
      (b) => Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z) > 0.015,
    );
  }
  get renderActive() {
    return (
      this.dragging ||
      this.power > 0 ||
      Math.abs(this.viewDistance - this.cameraGoal.distance) > 0.001 ||
      Math.abs(angleDelta(this.yaw, this.cameraGoal.yaw)) > 0.001 ||
      Math.abs(this.viewTilt - (this.cameraGoal.tilt ?? CAMERA_TILT)) > 0.001 ||
      this.focus.distanceToSquared(this.cameraGoal.focus) > 0.000001 ||
      this.marblesMoving
    );
  }
  private readonly overviewFocus = new THREE.Vector3(0, 0.05, 0);
  public onZoom?: (zoomed: boolean) => void;
  public zoomed = false;
  private matchMode = false;
  private readonly turnView = new TurnView();
  private planKey = '';
  private viewPlayer: number | null = null;
  private shotPending = false;
  private yaw = 0;
  private viewTilt = OVERVIEW_TILT;
  private viewDistance = 6;
  private cameraGoal: CameraPose = { yaw: 0, distance: 6, focus: { x: 0, y: 0.05, z: 0 } };
  private transitionFrom: CameraPose = { yaw: 0, distance: 6, focus: { x: 0, y: 0.05, z: 0 } };
  private transitionElapsed = 0.5;
  private readonly viewProbe = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  public viewBlocked = false;
  get viewEligible() {
    return this.turnView.eligible;
  }
  get viewAvailable() {
    return this.turnView.eligible && this.canAct && !this.dragging && this.power === 0;
  }
  get viewYaw() {
    return this.yaw;
  }
  private cameraDistance = 6;
  private focus = new THREE.Vector3(0, 0.05, 0);
  private showActivePlayer = false;
  private playerLabels: [string, string] | null = null;
  private readonly ballLabels: BallLabels;
  private dragPixels = { x: 0, y: 0 };
  private screenDrag = false;
  private readonly returnCancel = new ReturnCancel();
  private dragMarble = { x: 0, y: 0, radius: 0 };
  public onGesture?: (feedback: DragFeedback | null) => void;
  private dragSurface?: HTMLElement;
  public onPower?: (power: number) => void;
  public onCharge?: (phase: 'start' | 'move' | 'end', power: number) => void;
  public onAim?: (direction: Direction, power: number) => void;
  private readonly scene = new THREE.Scene();
  private terrain: TerrainData = DEFAULT_TERRAIN;
  private readonly ground = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly resizeObserver: ResizeObserver;
  private readonly balls: THREE.Group[] = [];
  private readonly targets = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly sampleRotation = new THREE.Quaternion();
  private readonly frames: PresentationFrame[] = [];
  private latestFrameReceivedAt = 0;
  private displayedTime = 0;
  private presentedBalls: BallState[] = [];
  get audioFrame(): AudioFrame {
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    return {
      time: this.displayedTime,
      balls: this.presentedBalls,
      fresh: performance.now() - this.latestFrameReceivedAt < 300,
      listener: { ...this.camera.position },
      forward: { ...forward },
      up: { ...up },
    };
  }
  /** Simulation seconds actually shown, for synchronizing the result overlay with the contact frame. */
  public get presentationTime(): number {
    return this.displayedTime;
  }
  private readonly preview = new THREE.Group();
  private readonly halo: THREE.Mesh;
  private readonly serveGuide: ServeGuide;
  private readonly serveLine: ServeLine;
  private readonly serveTap = new ServeTap();
  public onServePosition?: (x: number) => void;
  private readonly caustics: MarbleCaustics;
  private readonly aim = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(),
    0.4,
    BLUE,
    0.09,
    0.06,
  );
  private readonly boundary = new THREE.Group();
  private readonly nextBoundary = new THREE.Group();
  private boundaryValue = -1;
  private nextBoundaryValue = -1;
  private snapshot?: GameSnapshot;
  private canAct = false;
  private serveX = 0;
  private dragging = false;
  private pointerId = -1;
  private readonly dragStart = new THREE.Vector3();
  private readonly groundPoint = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly scratch = new THREE.Vector3();
  private readonly aimDirection = new THREE.Vector3(0, 0, -1);
  private power = 0;
  private reflection?: THREE.WebGLRenderTarget;
  private doorReflection?: ReturnType<typeof makeDoorReflection>;
  private disposed = false;
  private time = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly onShoot: (direction: Direction, power: number, serveX: number) => void,
    terrainSeed = 0,
  ) {
    this.terrain = createTerrain(terrainSeed);
    this.renderer.setPixelRatio(
      pixelRatioFor(
        this.quality,
        container.clientWidth,
        container.clientHeight,
        window.devicePixelRatio,
      ),
    );
    this.renderer.transmissionResolutionScale = this.quality.transmissionScale;
    // Every ordinary shadow caster is static; moving glass has its own optical shadow.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0xf5f3eb, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    canvas.setAttribute('aria-label', '弹珠场地：从自己的弹珠向后拖动，松手击球');
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    this.ballLabels = new BallLabels(container);
    this.camera.position.set(0, 5, 3);
    this.camera.lookAt(0, 0.05, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff9e9, 0x958772, 1.15));
    const sun = new THREE.DirectionalLight(0xfff3d9, 3.5);
    sun.position.copy(SUN_DIRECTION).multiplyScalar(Math.sqrt(50));
    sun.castShadow = true;
    const shadowSize = Math.min(this.quality.shadowSize, this.renderer.capabilities.maxTextureSize);
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.normalBias = 0.005;
    sun.shadow.bias = -0.0004;
    // A wide PCF disk compares neighbouring depths on the same sloping surface,
    // producing speckles that look like coarse fabric. Keep the filter local.
    sun.shadow.radius = 1;
    this.scene.add(sun);
    this.buildGround();
    this.fitShadow(sun);
    this.container.dataset.environment = 'loading';
    this.ready = loadCourtyard()
      .then(async (group) => {
        if (this.disposed) {
          disposeCourtyard(group);
          return;
        }
        group.scale.set(COURT_SCALE, 1, COURT_SCALE);
        this.scene.add(group);
        this.fitShadow(sun);
        startupStage('正在准备玻璃反光与光影');
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (this.disposed) return;
        this.reflection = captureCourtyardReflection(this.renderer, this.scene);
        // Apply the probe only to glass: preserve the established courtyard lighting.
        this.scene.traverse((object) => {
          if (
            object instanceof THREE.Mesh &&
            object.name === 'transmissive-glass-shell' &&
            object.material instanceof THREE.MeshPhysicalMaterial
          )
            object.material.envMap = this.reflection!.texture;
        });
        this.doorReflection = makeDoorReflection(this.quality.reflectionSize);
        const glazing = new THREE.Group();
        glazing.scale.set(COURT_SCALE, 1, COURT_SCALE);
        glazing.add(this.doorReflection);
        this.scene.add(glazing);
        this.caustics.setScene(this.scene, (x, z) => terrainHeight(x, z, this.terrain));
        this.planKey = '';
        this.planCamera();
        await this.renderer.compileAsync(this.scene, this.camera);
        if (this.disposed) return;
        this.render(0);
        this.container.dataset.environment = 'ready';
      })
      .catch((error: unknown) => {
        if (this.disposed) return;
        this.container.dataset.environment = 'error';
        const message = document.createElement('p');
        message.className = 'environment-error';
        message.textContent = '院落模型加载失败，请刷新重试。';
        this.container.append(message);
        console.error('Courtyard asset failed', error);
        throw error;
      });
    for (let p = 0; p < 2; p++) {
      const ball = makeMarble(p, this.quality.sphereSegments);
      ball.visible = false;
      this.balls.push(ball);
      this.scene.add(ball);
    }
    this.preview.add(
      makeMarble(0, this.quality.sphereSegments),
      makeMarble(1, this.quality.sphereSegments),
    );
    this.scene.add(this.preview, this.boundary, this.nextBoundary);
    this.halo = new THREE.Mesh(
      new THREE.RingGeometry(CONFIG.radius * 1.05, CONFIG.radius * 1.27, 64),
      new THREE.MeshBasicMaterial({
        color: BLUE,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.halo.rotation.x = -Math.PI / 2;
    this.scene.add(this.halo);
    this.aim.visible = false;
    this.scene.add(this.aim);
    this.drawBoundary(this.boundary, CONFIG.half, false);
    this.boundaryValue = CONFIG.half;
    this.syncPreview();
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('lostpointercapture', this.cancel);
    canvas.addEventListener('contextmenu', this.contextMenu);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('pointerdown', this.secondaryTouch, true);
    window.addEventListener('blur', this.cancel);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    this.serveGuide = new ServeGuide(container, this.terrain);
    this.serveLine = new ServeLine(container);
    this.caustics = new MarbleCaustics(this.balls[0].children[0] as THREE.Mesh, {
      size: this.quality.causticSize,
      photons: this.quality.photons,
    });
  }

  private fitShadow(sun: THREE.DirectionalLight) {
    // Fit all courtyard casters in light space, not just the playable court.
    this.scene.updateMatrixWorld(true);
    sun.shadow.updateMatrices(sun);
    const shadowBounds = new THREE.Box3();
    this.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh && object.castShadow) {
        const bounds = new THREE.Box3().setFromObject(object);
        bounds.applyMatrix4(sun.shadow.camera.matrixWorldInverse);
        shadowBounds.union(bounds);
      }
    });
    this.renderer.shadowMap.needsUpdate = true;
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = Math.floor(shadowBounds.min.x - 0.5);
    shadowCamera.right = Math.ceil(shadowBounds.max.x + 0.5);
    shadowCamera.bottom = Math.floor(shadowBounds.min.y - 0.5);
    shadowCamera.top = Math.ceil(shadowBounds.max.y + 0.5);
    shadowCamera.near = Math.max(0.1, -shadowBounds.max.z - 1);
    shadowCamera.far = -shadowBounds.min.z + 2;
    shadowCamera.updateProjectionMatrix();
  }

  private buildGround() {
    this.renderer.shadowMap.needsUpdate = true;
    this.doorReflection?.invalidate();
    disposeCourtyard(this.ground);
    this.ground.clear();
    this.ground.name = 'match-terrain';
    this.scene.add(this.ground);
    this.container.dataset.terrainSeed = String(this.terrain.seed);
    const data = makeTerrain(this.terrain);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    const colors = new Float32Array(this.terrain.colors.flatMap((c) => c.slice(0, 3)));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const uv = new Float32Array((data.vertices.length / 3) * 2);
    for (let i = 0; i < data.vertices.length / 3; i++) {
      uv[i * 2] = data.vertices[i * 3] / 0.24;
      uv[i * 2 + 1] = data.vertices[i * 3 + 2] / 0.24;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const soil = new THREE.Mesh(geometry, makeSoilMaterial(this.terrain.seed));
    soil.receiveShadow = soil.castShadow = true;
    this.ground.add(soil);
    const stoneGeometry = new THREE.BufferGeometry();
    stoneGeometry.setAttribute('position', new THREE.BufferAttribute(ROCK_VERTICES, 3));
    stoneGeometry.setIndex(new THREE.BufferAttribute(ROCK_INDICES, 1));
    stoneGeometry.computeVertexNormals();
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x858676,
      roughness: 1,
      flatShading: true,
    });
    for (const rock of this.terrain.rocks) {
      const mesh = new THREE.Mesh(stoneGeometry, stoneMaterial);
      mesh.scale.set(rock.radius, rock.height, rock.radius);
      mesh.position.set(rock.x, rock.y, rock.z);
      mesh.castShadow = mesh.receiveShadow = true;
      this.ground.add(mesh);
    }
    // The shared serving line is chalk, with small endpoint ticks.
    const serve = new THREE.Group();
    this.ground.add(serve);
    this.chalkSegment(serve, -SERVE_RANGE, SERVE_Z, SERVE_RANGE, SERVE_Z, 0.012, 0xffefd0, 0.94);
    for (const x of [-SERVE_RANGE, SERVE_RANGE])
      this.chalkSegment(serve, x, SERVE_Z - 0.035, x, SERVE_Z + 0.035, 0.01, 0xffefd0, 0.9);
  }

  private chalkSegment(
    group: THREE.Group,
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    width: number,
    color: number,
    opacity: number,
  ) {
    const count = Math.max(2, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.035));
    const positions: number[] = [],
      indices: number[] = [],
      len = Math.hypot(x2 - x1, z2 - z1),
      nx = ((-(z2 - z1) / len) * width) / 2,
      nz = (((x2 - x1) / len) * width) / 2;
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        x = x1 + (x2 - x1) * t,
        z = z1 + (z2 - z1) * t;
      for (const s of [-1, 1])
        positions.push(
          x + nx * s,
          terrainHeight(x + nx * s, z + nz * s, this.terrain) + 0.002,
          z + nz * s,
        );
      if (i < count) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    group.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
    );
  }

  private drawBoundary(group: THREE.Group, half: number, dashed: boolean) {
    for (const child of [...group.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      group.remove(child);
    }
    const corners = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    for (let side = 0; side < 4; side++) {
      const a = corners[side],
        b = corners[(side + 1) % 4],
        n = dashed ? Math.max(4, Math.round(half * 15)) : 1;
      for (let j = 0; j < n; j++) {
        const t1 = j / n,
          t2 = (j + (dashed ? 0.45 : 1)) / n;
        this.chalkSegment(
          group,
          a[0] + (b[0] - a[0]) * t1,
          a[1] + (b[1] - a[1]) * t1,
          a[0] + (b[0] - a[0]) * t2,
          a[1] + (b[1] - a[1]) * t2,
          dashed ? 0.006 : 0.014,
          dashed ? 0x956d44 : 0xfff3d9,
          dashed ? 0.5 : 0.86,
        );
      }
    }
  }

  update(snapshot: GameSnapshot, canAct: boolean, viewPlayer: number | null = null) {
    if (this.shotPending && (canAct || snapshot.phase !== 'aiming' || viewPlayer === null)) {
      this.shotPending = false;
      this.planKey = '';
    }
    if (snapshot.terrainSeed !== this.terrain.seed) {
      this.clearAim();
      this.terrain = createTerrain(snapshot.terrainSeed);
      this.buildGround();
      this.boundaryValue = this.nextBoundaryValue = -1;
      this.serveGuide.setTerrain(this.terrain);
      this.caustics.setScene(this.scene, (x, z) => terrainHeight(x, z, this.terrain));
      if (this.reflection) {
        const old = this.reflection;
        this.reflection = captureCourtyardReflection(this.renderer, this.scene);
        this.scene.traverse((object) => {
          if (
            object instanceof THREE.Mesh &&
            object.name === 'transmissive-glass-shell' &&
            object.material instanceof THREE.MeshPhysicalMaterial
          )
            object.material.envMap = this.reflection!.texture;
        });
        old.dispose();
      }
    }
    const reset =
      !this.snapshot ||
      this.snapshot.match !== snapshot.match ||
      this.snapshot.terrainSeed !== snapshot.terrainSeed ||
      (this.snapshot.balls.length === 0 && snapshot.balls.length > 0);
    if (this.snapshot?.turn !== snapshot.turn || !canAct) this.clearAim();
    this.snapshot = snapshot;
    this.viewPlayer = viewPlayer;
    this.canAct = canAct && snapshot.phase === 'aiming';
    this.renderer.domElement.style.cursor = this.canAct ? 'grab' : 'default';
    this.bufferSnapshot(snapshot, reset);
    for (const state of snapshot.balls)
      this.targets[state.player].set(state.position.x, state.position.y, state.position.z);
    if (reset) this.sampleFrames();
    if (snapshot.boundary !== this.boundaryValue) {
      this.boundaryValue = snapshot.boundary;
      this.drawBoundary(this.boundary, snapshot.boundary, false);
    }
    if (snapshot.nextBoundary !== this.nextBoundaryValue) {
      this.nextBoundaryValue = snapshot.nextBoundary;
      this.drawBoundary(this.nextBoundary, snapshot.nextBoundary, true);
    }
    this.nextBoundary.visible =
      snapshot.nextBoundary < snapshot.boundary && snapshot.phase !== 'finished';
    this.syncPreview();
    this.turnView.update(
      {
        key: `${snapshot.terrainSeed}:${snapshot.match}:${snapshot.turn}`,
        phase: snapshot.phase,
        active: snapshot.active,
        served: snapshot.served,
        hasPair: snapshot.balls.length === 2,
      },
      this.matchMode ? viewPlayer : null,
    );
    this.planCamera();
    this.onZoom?.(this.zoomed);
  }

  private bufferSnapshot(snapshot: GameSnapshot, reset: boolean) {
    const frame: PresentationFrame = { time: snapshot.time, balls: [undefined, undefined] };
    // Own these small copies: a local simulation may reuse its state objects after update().
    for (const ball of snapshot.balls)
      frame.balls[ball.player] = {
        player: ball.player,
        grounded: ball.grounded,
        rollingSpeed: ball.rollingSpeed,
        position: { ...ball.position },
        rotation: { ...ball.rotation },
        velocity: { ...ball.velocity },
      };
    if (reset) {
      this.frames.length = 0;
      this.displayedTime = frame.time;
    }
    const latest = this.frames[this.frames.length - 1];
    if (!latest || frame.time > latest.time) {
      this.frames.push(frame);
      this.latestFrameReceivedAt = performance.now();
    } else if (frame.time === latest.time) {
      // Repeated final/idle snapshots must not continually postpone reaching the last frame.
      this.frames[this.frames.length - 1] = frame;
    } else return; // An old packet cannot rewind presentation.
    if (this.frames.length > 32) this.frames.splice(0, this.frames.length - 32);
  }

  private sampleFrames() {
    const count = this.frames.length;
    if (!count) return;
    const latest = this.frames[count - 1];
    const elapsed = Math.max(0, (performance.now() - this.latestFrameReceivedAt) / 1000);
    const wanted = Math.min(latest.time, latest.time + elapsed - 0.1);
    this.displayedTime = Math.max(this.displayedTime, this.frames[0].time, wanted);
    // Preserve the bracketing pair, and never extrapolate a trajectory beyond server evidence.
    while (this.frames.length > 2 && this.frames[1].time <= this.displayedTime) this.frames.shift();
    const before = this.frames[0],
      after = this.frames[1] ?? before;
    const alpha =
      after.time > before.time
        ? THREE.MathUtils.clamp(
            (this.displayedTime - before.time) / (after.time - before.time),
            0,
            1,
          )
        : 1;
    this.presentedBalls = [];
    for (let p = 0; p < 2; p++) {
      const a = before.balls[p],
        b = after.balls[p],
        ball = this.balls[p];
      const state = alpha >= 1 ? b : a;
      ball.visible = !!state;
      if (!state) continue;
      ball.position.set(state.position.x, state.position.y, state.position.z);
      ball.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
      if (a && b && alpha < 1) {
        this.scratch.set(b.position.x, b.position.y, b.position.z);
        ball.position.lerp(this.scratch, alpha);
        this.sampleRotation.set(b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w);
        ball.quaternion.slerp(this.sampleRotation, alpha);
      }
      this.presentedBalls.push({
        ...state,
        position: { ...ball.position },
        rollingSpeed:
          a && b
            ? THREE.MathUtils.lerp(a.rollingSpeed ?? 0, b.rollingSpeed ?? 0, alpha)
            : state.rollingSpeed,
      });
    }
  }

  setServeX(x: number) {
    this.doorReflection?.invalidate();
    this.serveX = THREE.MathUtils.clamp(x, -SERVE_RANGE, SERVE_RANGE);
    this.syncPreview();
    if (this.power > 0) this.setAim(this.aimDirection, this.power);
  }
  private syncPreview() {
    const active = this.snapshot?.active ?? 0,
      serving = !this.snapshot?.served[active];
    this.preview.visible = serving && (!this.snapshot || this.snapshot.phase === 'aiming');
    const high = !this.snapshot || active === this.snapshot.first;
    const ground = terrainHeight(this.serveX, SERVE_Z, this.terrain);
    this.preview.position.set(
      this.serveX,
      ground + (high ? CONFIG.serveHeight : CONFIG.radius),
      SERVE_Z,
    );
    this.preview.children.forEach((child, p) => {
      child.visible = p === active;
    });
    this.halo.visible =
      (this.preview.visible && !high) || (this.canAct && !!this.snapshot?.served[active]);
    const origin = this.preview.visible ? this.preview.position : this.targets[active];
    this.halo.position.set(
      origin.x,
      terrainHeight(origin.x, origin.z, this.terrain) + 0.004,
      origin.z,
    );
    (this.halo.material as THREE.MeshBasicMaterial).color.setHex(active ? AMBER : BLUE);
  }

  setAim(direction: Direction, power: number) {
    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.z) || !Number.isFinite(power))
      return;
    this.aimDirection.set(direction.x, 0, direction.z);
    if (this.aimDirection.lengthSq() < 0.00001) return;
    this.aimDirection.normalize();
    this.power = THREE.MathUtils.clamp(power, 0, 1);
    const active = this.snapshot?.active ?? 0,
      origin = this.preview.visible ? this.preview.position : this.targets[active];
    this.aim.position.set(
      origin.x,
      terrainHeight(origin.x, origin.z, this.terrain) + 0.025,
      origin.z,
    );
    this.aim.setDirection(this.aimDirection);
    this.aim.setLength(0.12 + this.power * 0.68, 0.07, 0.05);
    this.aim.setColor(active ? AMBER : BLUE);
    this.aim.visible =
      this.canAct &&
      this.power > 0.01 &&
      !(this.preview.visible && this.snapshot?.active === this.snapshot?.first);
    this.onZoom?.(this.zoomed);
  }
  clearAim() {
    const changed = this.dragging || this.power > 0;
    this.dragging = false;
    this.serveTap.clear();
    this.returnCancel.clear();
    this.onGesture?.(null);
    if (this.dragSurface?.hasPointerCapture(this.pointerId))
      this.dragSurface.releasePointerCapture(this.pointerId);
    this.power = 0;
    this.aim.visible = false;
    if (changed) {
      this.onPower?.(0);
      this.serveGuide.clearAim();
    }
    this.onCharge?.('end', 0);
    this.onZoom?.(this.zoomed);
  }

  setPlayerLabels(names: [string, string] | null, showActive = true) {
    this.showActivePlayer = showActive;
    this.playerLabels = names;
  }
  setMatchMode(enabled: boolean) {
    if (enabled === this.matchMode) return;
    this.matchMode = enabled;
    if (!enabled) {
      this.planKey = '';
      this.zoomed = false;
      this.cameraGoal = {
        yaw: 0,
        distance: this.cameraDistance,
        focus: { ...this.overviewFocus },
        tilt: OVERVIEW_TILT,
      };
    }
  }
  setZoom(zoomed: boolean) {
    if (!this.viewAvailable) return;
    this.turnView.choose(zoomed);
    this.planKey = '';
    this.planCamera();
    this.onZoom?.(this.zoomed);
  }
  holdShotView() {
    this.shotPending = true;
    this.cameraGoal = {
      yaw: this.yaw,
      distance: this.viewDistance,
      focus: { ...this.focus },
      tilt: this.viewTilt,
    };
    this.transitionFrom = this.cameraGoal;
    this.transitionElapsed = 0.5;
  }
  private planCamera() {
    const s = this.snapshot;
    const key = `${s?.terrainSeed}:${s?.match}:${s?.turn}:${this.viewPlayer}:${this.turnView.mode}:${this.camera.aspect}:${this.cameraDistance}`;
    if (key === this.planKey) return;
    this.planKey = key;
    this.transitionFrom = {
      yaw: this.yaw,
      distance: this.viewDistance,
      focus: { ...this.focus },
      tilt: this.viewTilt,
    };
    this.transitionElapsed = 0;
    if (this.turnView.mode === 'shot' && this.matchMode) {
      this.cameraGoal = {
        yaw: this.yaw,
        distance: this.viewDistance,
        focus: { ...this.focus },
        tilt: this.viewTilt,
      };
      return;
    }
    this.viewBlocked = false;
    this.zoomed = false;
    this.cameraGoal = {
      yaw: 0,
      distance: this.cameraDistance,
      focus: { ...this.overviewFocus },
      tilt: OVERVIEW_TILT,
    };
    if (!s || !this.matchMode || this.turnView.mode !== 'aim') return;
    const own = s.balls.find((b) => b.player === s.active)?.position;
    const other = s.balls.find((b) => b.player !== s.active)?.position;
    if (!own || !other) return;
    for (const weight of this.quality.mobile
      ? [0.35, 0.45, 0.55, 0.7, 0.85, 1]
      : [0.55, 0.7, 0.85, 1]) {
      const limit = this.quality.mobile
        ? touchViewLimit(this.container.clientWidth, this.container.clientHeight)
        : 0.78;
      const pose = pairPose(own, other, this.camera.aspect, weight, limit);
      if (!pose) return;
      const eye = cameraPosition(pose);
      this.viewProbe.position.set(eye.x, eye.y, eye.z);
      this.viewProbe.lookAt(pose.focus.x, pose.focus.y, pose.focus.z);
      this.viewProbe.updateMatrixWorld();
      if (
        ![own, other].every((p) =>
          this.caustics.isBallVisible(new THREE.Vector3(p.x, p.y, p.z), this.viewProbe),
        )
      )
        continue;
      this.cameraGoal = pose;
      this.zoomed = true;
      return;
    }
    this.viewBlocked = true;
  }
  private updateCamera(dt: number, immediate = false) {
    // During a gesture even an unfinished transition stops, so aim cannot drift.
    if ((this.dragging || this.power > 0) && !immediate) return;
    if (this.turnView.mode === 'shot' && this.zoomed && this.marblesMoving) {
      const points = this.presentedBalls.map((b) => b.position);
      this.cameraGoal.distance = Math.max(
        this.cameraGoal.distance,
        Math.min(
          this.cameraDistance * 1.2,
          fitDistance(points, this.cameraGoal.focus, this.cameraGoal.yaw, this.camera.aspect),
        ),
      );
    }
    this.transitionElapsed =
      immediate || this.reducedMotion.matches ? 0.5 : this.transitionElapsed + dt;
    const t =
      immediate || this.reducedMotion.matches ? 1 : Math.min(1, this.transitionElapsed / 0.5);
    const alpha = t * t * (3 - 2 * t);
    this.yaw =
      this.transitionFrom.yaw + angleDelta(this.transitionFrom.yaw, this.cameraGoal.yaw) * alpha;
    this.viewDistance =
      this.turnView.mode === 'shot'
        ? THREE.MathUtils.lerp(
            this.viewDistance,
            this.cameraGoal.distance,
            immediate || this.reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 12),
          )
        : THREE.MathUtils.lerp(this.transitionFrom.distance, this.cameraGoal.distance, alpha);
    this.focus.copy(this.transitionFrom.focus).lerp(this.cameraGoal.focus, alpha);
    this.viewTilt = THREE.MathUtils.lerp(
      this.transitionFrom.tilt ?? CAMERA_TILT,
      this.cameraGoal.tilt ?? CAMERA_TILT,
      alpha,
    );
    const tilt = this.viewTilt,
      d = this.viewDistance;
    this.camera.position.set(
      this.focus.x + d * Math.cos(tilt) * Math.sin(this.yaw),
      this.focus.y + d * Math.sin(tilt),
      this.focus.z + d * Math.cos(tilt) * Math.cos(this.yaw),
    );
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
  }
  private resize = () => {
    if (this.dragging || this.power > 0) this.clearAim();
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight),
      aspect = width / height;
    this.camera.aspect = aspect;
    this.cameraDistance = overviewDistance(aspect, this.overviewFocus, this.camera.fov);
    this.planKey = '';
    this.planCamera();
    this.updateCamera(0, true);
    this.camera.updateProjectionMatrix();
    const ratio = pixelRatioFor(this.quality, width, height, window.devicePixelRatio);
    if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
  };
  private eventGround(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.plane, this.groundPoint);
  }
  private updateServeLine() {
    this.serveLine.update(
      this.camera,
      this.container.clientWidth,
      this.container.clientHeight,
      this.terrain,
      this.canAct && this.preview.visible,
      this.snapshot?.active ?? 0,
      this.serveX,
    );
  }
  private pointerDown = (event: PointerEvent) => this.beginDrag(event);
  private beginDrag(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || !this.canAct || this.dragging) return;
    const active = this.snapshot?.active ?? 0,
      origin = this.preview.visible ? this.preview.position : this.balls[active].position;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.updateServeLine();
    const candidate = this.serveLine.pick(
      event.clientX - rect.left,
      event.clientY - rect.top,
      event.pointerType === 'touch',
    );
    this.scratch.copy(origin).project(this.camera);
    const x = rect.left + ((this.scratch.x + 1) * rect.width) / 2,
      y = rect.top + ((1 - this.scratch.y) * rect.height) / 2;
    this.scratch.copy(this.halo.position).project(this.camera);
    const hx = rect.left + ((this.scratch.x + 1) * rect.width) / 2,
      hy = rect.top + ((1 - this.scratch.y) * rect.height) / 2;
    if (
      event.pointerType !== 'touch' &&
      candidate === null &&
      Math.hypot(event.clientX - x, event.clientY - y) > 42 &&
      Math.hypot(event.clientX - hx, event.clientY - hy) > 30
    )
      return;
    if (!this.eventGround(event)) return;
    this.dragStart.copy(this.groundPoint);
    this.dragPixels = { x: event.clientX, y: event.clientY };
    this.screenDrag = event.pointerType === 'touch';
    // A new gesture starts at zero; a click must not launch a preset shot.
    this.clearAim();
    this.serveTap.begin(candidate);
    this.scratch.copy(origin).applyMatrix4(this.camera.matrixWorldInverse);
    this.dragMarble = {
      x: x - rect.left,
      y: y - rect.top,
      radius:
        (CONFIG.radius * rect.height) /
        (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * -this.scratch.z),
    };
    this.returnCancel.begin(
      Math.hypot(event.clientX - x, event.clientY - y),
      Math.max(18, this.dragMarble.radius + 5),
    );
    this.dragging = true;
    this.onZoom?.(this.zoomed);
    if (candidate === null) this.onCharge?.('start', 0);
    this.pointerId = event.pointerId;
    this.dragSurface = event.currentTarget as HTMLElement;
    this.dragSurface.setPointerCapture(event.pointerId);
    this.renderer.domElement.focus({ preventScroll: true });
    this.renderer.domElement.style.cursor = 'grabbing';
    event.preventDefault();
  }
  private pointerMove = (event: PointerEvent) => {
    if (
      !this.dragging ||
      event.pointerId !== this.pointerId ||
      !this.canAct ||
      (!this.screenDrag && !this.eventGround(event))
    )
      return;
    const wasPending = this.serveTap.pending;
    this.serveTap.move(
      Math.hypot(event.clientX - this.dragPixels.x, event.clientY - this.dragPixels.y),
    );
    if (this.serveTap.pending) return;
    if (wasPending) this.onCharge?.('start', 0);
    if (this.screenDrag) {
      const { direction, power: rawPower } = touchAim(
        event.clientX - this.dragPixels.x,
        event.clientY - this.dragPixels.y,
        touchTravel(this.container.clientWidth, this.container.clientHeight),
        this.yaw,
      );
      const distance = Math.hypot(
        event.clientX - this.dragPixels.x,
        event.clientY - this.dragPixels.y,
      );
      const rect = this.container.getBoundingClientRect();
      const cancelled = this.returnCancel.update(
        Math.hypot(
          event.clientX - rect.left - this.dragMarble.x,
          event.clientY - rect.top - this.dragMarble.y,
        ),
        Math.max(18, this.dragMarble.radius + 5),
      );
      const power = cancelled ? 0 : rawPower;
      this.onGesture?.(
        distance >= 5 || cancelled
          ? {
              marble: this.dragMarble,
              cancelled,
            }
          : null,
      );
      this.setAim(direction, power);
      if (power === 0) this.serveGuide.clearAim();
      this.onPower?.(power);
      this.onAim?.(direction, power);
      this.onCharge?.('move', power);
      return;
    }
    this.scratch.subVectors(this.dragStart, this.groundPoint);
    this.scratch.y = 0;
    const distance = this.scratch.length();
    if (distance < 0.008) {
      this.aim.visible = false;
      this.power = 0;
      this.onPower?.(0);
      this.onCharge?.('move', 0);
      return;
    }
    this.scratch.multiplyScalar(1 / distance);
    const direction = { x: this.scratch.x, z: this.scratch.z },
      power = THREE.MathUtils.clamp(distance / 0.85, 0, 1);
    this.setAim(direction, power);
    this.onPower?.(power);
    this.onAim?.(direction, power);
    this.onCharge?.('move', power);
  };
  private pointerUp = (event: PointerEvent) => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    if (this.screenDrag) this.pointerMove(event);
    this.serveTap.move(
      Math.hypot(event.clientX - this.dragPixels.x, event.clientY - this.dragPixels.y),
    );
    const selected = this.canAct && this.preview.visible ? this.serveTap.finish() : null;
    const power = this.power,
      direction = { x: this.aimDirection.x, z: this.aimDirection.z },
      valid = this.canAct && power >= 0.045;
    this.clearAim();
    if (this.renderer.domElement.hasPointerCapture(event.pointerId))
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    this.renderer.domElement.style.cursor = this.canAct ? 'grab' : 'default';
    if (selected !== null) {
      this.setServeX(selected);
      this.onServePosition?.(this.serveX);
    } else if (valid) this.onShoot(direction, power, this.serveX);
  };
  private cancel = () => {
    this.clearAim();
    this.renderer.domElement.style.cursor = this.canAct ? 'grab' : 'default';
  };
  private secondaryTouch = (event: PointerEvent) => {
    if (event.pointerType === 'touch' && !event.isPrimary) this.cancel();
  };
  private visibilityChanged = () => {
    if (document.hidden) this.cancel();
  };
  private contextMenu = (event: MouseEvent) => {
    event.preventDefault();
    this.cancel();
  };
  private keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.cancel();
  };

  render(dt: number) {
    if (this.disposed) return;
    this.time += Math.min(dt, 0.1);
    this.sampleFrames();
    this.updateCamera(dt);
    this.updateServeLine();
    const scale = 1 + Math.sin(this.time * 2.8) * 0.045;
    this.halo.scale.setScalar(scale);
    this.serveGuide.update(this.camera, this.container.clientWidth, this.container.clientHeight, {
      visible:
        this.preview.visible && (!this.snapshot || this.snapshot.active === this.snapshot.first),
      canAim: this.canAct,
      origin: this.preview.position,
      ground: this.halo.position,
      direction: this.aimDirection,
      power: this.power,
      bound: this.snapshot?.boundary ?? CONFIG.half,
    });
    const active = this.snapshot?.active ?? 0;
    const points = [0, 1].map((p) =>
      this.preview.visible && p === active
        ? this.preview.position
        : this.balls[p].visible
          ? this.balls[p].position
          : null,
    );
    const arrow = this.aim.visible
      ? [
          this.aim.position,
          this.aim.position.clone().addScaledVector(this.aimDirection, 0.12 + this.power * 0.68),
        ]
      : null;
    this.ballLabels.update(
      this.camera,
      this.container.clientWidth,
      this.container.clientHeight,
      this.playerLabels,
      points.map((point) =>
        point && this.caustics.isBallVisible(point, this.camera) ? point : null,
      ),
      active,
      this.showActivePlayer && this.snapshot?.phase === 'aiming',
      arrow,
    );
    // The SVG arrow has constant pixel width on small screens.
    const oldVisible = this.aim.visible;
    if (arrow) this.aim.visible = false;
    this.scene.updateMatrixWorld(true);
    this.caustics.update(
      [0, 1].map((player) =>
        this.preview.visible && this.preview.children[player].visible
          ? this.preview.children[player]
          : this.balls[player].visible
            ? this.balls[player]
            : undefined,
      ),
      this.camera,
      this.container.clientHeight,
    );
    this.doorReflection?.setDynamic(this.marblesMoving);
    this.renderer.render(this.scene, this.camera);
    this.aim.visible = oldVisible;
  }
  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.serveGuide.dispose();
    this.serveLine.dispose();
    this.ballLabels.dispose();
    this.caustics.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown);
    canvas.removeEventListener('pointermove', this.pointerMove);
    canvas.removeEventListener('pointerup', this.pointerUp);
    canvas.removeEventListener('pointercancel', this.cancel);
    canvas.removeEventListener('lostpointercapture', this.cancel);
    canvas.removeEventListener('contextmenu', this.contextMenu);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('pointerdown', this.secondaryTouch, true);
    window.removeEventListener('blur', this.cancel);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material)
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    disposeMaterialTextures(materials);
    materials.forEach((material) => material.dispose());
    this.reflection?.dispose();
    this.doorReflection?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
