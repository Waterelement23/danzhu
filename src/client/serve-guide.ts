import * as THREE from 'three';
import { CONFIG } from '../shared/map';
import type { ServeFlight, ServePredictor } from '../shared/serve-preview';
import type { Vec3 } from '../shared/types';

/** Screen-sized annotations remain legible at every camera distance and never enter reflections. */
export class ServeGuide {
  private readonly root = document.createElement('div');
  private predictor?: ServePredictor;
  private flight?: ServeFlight;
  private key = '';
  private disposed = false;
  private readonly svg: SVGSVGElement;
  private readonly height: HTMLElement;
  private readonly originLabel: HTMLElement;
  private readonly endLabel: HTMLElement;
  private readonly hint: HTMLElement;
  constructor(container: HTMLElement) {
    this.root.className = 'serve-guide';
    this.root.innerHTML = `<svg aria-hidden="true"><path class="flight-outline"/><path class="flight-path"/><path class="height-outline"/><path class="height-path"/><circle class="serve-foot" r="7"/><path class="flight-end"/></svg><span class="serve-height-label">离地 ${Math.round(CONFIG.serveHeight * 100)} 厘米</span><span class="serve-origin-label">正下方 · 发球位置</span><span class="serve-end-label"></span><span class="serve-drag-hint">向后拖动弹珠，松手发射</span>`;
    this.svg = this.root.querySelector('svg')!;
    this.height = this.root.querySelector('.serve-height-label')!;
    this.originLabel = this.root.querySelector('.serve-origin-label')!;
    this.endLabel = this.root.querySelector('.serve-end-label')!;
    this.hint = this.root.querySelector('.serve-drag-hint')!;
    container.append(this.root);
    void import('../shared/serve-preview')
      .then((m) => m.ServePredictor.create())
      .then((p) => {
        if (this.disposed) p.dispose();
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
      dragging: boolean;
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
    const ball = project(input.origin),
      foot = project(input.ground);
    const below = project({ ...input.origin, y: input.origin.y - CONFIG.radius });
    const path = `M${below.x},${below.y}L${foot.x},${foot.y}M${foot.x - 5},${foot.y}h10`;
    for (const name of ['height-outline', 'height-path'])
      this.svg.querySelector(`.${name}`)!.setAttribute('d', path);
    const circle = this.svg.querySelector('circle')!;
    circle.setAttribute('cx', String(foot.x));
    circle.setAttribute('cy', String(foot.y));
    const label = (el: HTMLElement, x: number, y: number) => {
      el.style.left = `${Math.max(6, Math.min(width - el.offsetWidth - 6, x))}px`;
      el.style.top = `${Math.max(6, Math.min(height - el.offsetHeight - 6, y))}px`;
    };
    label(this.height, foot.x + 15, (below.y + foot.y) / 2 - 12);
    label(this.originLabel, foot.x - 58, foot.y + 13);
    this.hint.hidden = !input.canAim || input.dragging;
    label(this.hint, ball.x - this.hint.offsetWidth - 20, ball.y - 10);
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
    this.endLabel.hidden = !flight;
    this.root.dataset.prediction = flight?.kind ?? 'none';
    const curve =
      flight?.points
        .map((p, i) => {
          const q = project(p);
          return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(' ') ?? '';
    for (const name of ['flight-outline', 'flight-path'])
      this.svg.querySelector(`.${name}`)!.setAttribute('d', curve);
    this.svg.querySelector('.flight-end')!.setAttribute('d', '');
    if (flight) {
      const end = project(flight.end),
        r = 8;
      this.svg
        .querySelector('.flight-end')!
        .setAttribute('d', `M${end.x},${end.y - r}l${r},${r}l${-r},${r}l${-r},${-r}Z`);
      this.endLabel.textContent =
        flight.kind === 'out'
          ? '将先出界'
          : flight.kind === 'stone'
            ? '预计先碰到石子'
            : '预计首次触地';
      label(this.endLabel, end.x - this.endLabel.offsetWidth / 2, end.y - 33);
    }
  }
  dispose() {
    this.disposed = true;
    this.predictor?.dispose();
    this.root.remove();
  }
}
