import * as THREE from 'three';
import { CONFIG, DEFAULT_TERRAIN, type TerrainData } from '../shared/map';
import type { ServeFlight, ServePredictor } from '../shared/serve-preview';
import type { Vec3 } from '../shared/types';

/** Screen-sized annotations remain legible at every camera distance and never enter reflections. */
export class ServeGuide {
  private readonly root = document.createElement('div');
  private predictor?: ServePredictor;
  private flight?: ServeFlight;
  private key = '';
  private disposed = false;
  private terrain?: TerrainData;
  private generation = 0;
  private readonly svg: SVGSVGElement;
  constructor(container: HTMLElement, terrain = DEFAULT_TERRAIN) {
    this.root.className = 'serve-guide';
    this.root.setAttribute('role', 'img');
    this.root.setAttribute(
      'aria-label',
      `高位发球：弹珠离地 ${Math.round(CONFIG.serveHeight * 100)} 厘米，虚线连接弹珠与正下方地面，弧线表示预计首次接触路线。`,
    );
    this.root.innerHTML =
      '<svg aria-hidden="true"><path class="flight-path"/><path class="height-path"/><path class="serve-foot"/><path class="flight-end"/></svg>';
    this.svg = this.root.querySelector('svg')!;
    container.append(this.root);
    this.setTerrain(terrain);
  }
  setTerrain(terrain: TerrainData) {
    if (this.terrain?.seed === terrain.seed) return;
    this.terrain = terrain;
    const generation = ++this.generation;
    this.predictor?.dispose();
    this.predictor = undefined;
    this.flight = undefined;
    this.key = '';
    this.svg.querySelector('.flight-path')!.setAttribute('d', '');
    this.svg.querySelector('.flight-end')!.setAttribute('d', '');
    void import('../shared/serve-preview')
      .then((m) => m.ServePredictor.create(terrain))
      .then((p) => {
        if (this.disposed || generation !== this.generation) p.dispose();
        else this.predictor = p;
      })
      .catch((error) => console.warn('Serve prediction unavailable', error));
  }
  update(
    camera: THREE.Camera,
    width: number,
    height: number,
    input: {
      visible: boolean;
      canAim: boolean;
      origin: Vec3;
      ground: Vec3;
      direction: { x: number; z: number };
      power: number;
      bound: number;
    },
  ) {
    this.root.hidden = !input.visible;
    if (!input.visible) return;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const project = (p: Vec3) => {
      const v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
      return { x: ((v.x + 1) * width) / 2, y: ((1 - v.y) * height) / 2 };
    };
    const foot = project(input.ground);
    const below = project({ ...input.origin, y: input.origin.y - CONFIG.radius });
    this.svg
      .querySelector('.height-path')!
      .setAttribute('d', `M${below.x},${below.y}L${foot.x},${foot.y}`);
    this.svg.querySelector('.serve-foot')!.setAttribute('d', `M${foot.x - 3},${foot.y}h6`);
    const key = JSON.stringify([
      input.origin.x,
      input.direction.x,
      input.direction.z,
      input.power,
      input.bound,
    ]);
    if (input.canAim && input.power > 0 && this.predictor && key !== this.key) {
      try {
        this.flight = this.predictor.predict(
          input.origin.x,
          input.direction,
          input.power,
          input.bound,
        );
      } catch (error) {
        this.flight = undefined;
        console.warn('Serve preview skipped', error);
      }
      this.key = key;
    }
    // Never display an old curve after moving the serve point or changing aim.
    const flight = input.canAim && input.power > 0 && key === this.key ? this.flight : undefined;
    this.root.dataset.prediction = flight?.kind ?? 'none';
    const curve =
      flight?.points
        .map((p, i) => {
          const q = project(p);
          return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(' ') ?? '';
    this.svg.querySelector('.flight-path')!.setAttribute('d', curve);
    this.svg.querySelector('.flight-end')!.setAttribute('d', '');
    if (flight) {
      const end = project(flight.end),
        r = 4;
      this.svg
        .querySelector('.flight-end')!
        .setAttribute('d', `M${end.x},${end.y - r}l${r},${r}l${-r},${r}l${-r},${-r}Z`);
    }
  }
  dispose() {
    this.disposed = true;
    this.predictor?.dispose();
    this.root.remove();
  }
}
