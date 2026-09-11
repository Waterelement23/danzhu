import { Vector3, type Camera } from 'three';
import { SERVE_RANGE, SERVE_Z, terrainHeight, type TerrainData } from '../shared/map';
import { pickServePosition, type ServeSample } from './serve-selection';

/** Screen-space affordance follows the physical serve line; it never intercepts pointer input. */
export class ServeLine {
  private root = document.createElement('div');
  private svg: SVGSVGElement;
  private line: SVGPathElement;
  private outline: SVGPathElement;
  private ticks: SVGPathElement;
  private selected: SVGPathElement;
  private samples: ServeSample[] = [];
  private scratch = new Vector3();
  constructor(container: HTMLElement) {
    this.root.className = 'serve-line';
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML =
      '<svg><path class="serve-line-outline"/><path class="serve-line-path"/><path class="serve-line-ticks"/><path class="serve-line-selected"/></svg>';
    this.svg = this.root.querySelector('svg')!;
    this.outline = this.root.querySelector('.serve-line-outline')!;
    this.line = this.root.querySelector('.serve-line-path')!;
    this.ticks = this.root.querySelector('.serve-line-ticks')!;
    this.selected = this.root.querySelector('.serve-line-selected')!;
    container.append(this.root);
  }
  update(
    camera: Camera,
    width: number,
    height: number,
    terrain: TerrainData,
    enabled: boolean,
    player: number,
    selectedX: number,
  ) {
    this.root.hidden = !enabled;
    if (!enabled) {
      this.samples = [];
      return;
    }
    this.root.dataset.player = String(player);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const project = (x: number): ServeSample => {
      this.scratch.set(x, terrainHeight(x, SERVE_Z, terrain) + 0.012, SERVE_Z).project(camera);
      return {
        x: ((this.scratch.x + 1) * width) / 2,
        y: ((1 - this.scratch.y) * height) / 2,
        worldX: x,
      };
    };
    this.samples = Array.from({ length: 17 }, (_, i) =>
      project(-SERVE_RANGE + (2 * SERVE_RANGE * i) / 16),
    );
    const path = this.samples.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    this.line.setAttribute('d', path);
    this.outline.setAttribute('d', path);
    this.ticks.setAttribute(
      'd',
      [0, 4, 8, 12, 16]
        .map((i) => {
          const p = this.samples[i];
          return `M${p.x},${p.y - 4}v8`;
        })
        .join(' '),
    );
    const p = project(selectedX);
    this.selected.setAttribute('d', `M${p.x},${p.y - 7}v14`);
  }
  pick(x: number, y: number, touch: boolean) {
    return pickServePosition({ x, y }, this.samples, touch ? 22 : 12);
  }
  dispose() {
    this.root.remove();
  }
}
