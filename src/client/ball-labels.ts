import * as THREE from 'three';
/** Screen-space identity labels and aiming direction; this is not a bounce prediction. */
export class BallLabels {
  private root = document.createElement('div');
  private labels: HTMLSpanElement[];
  private svg: SVGSVGElement;
  private line: SVGPathElement;
  private outline: SVGPathElement;
  constructor(container: HTMLElement) {
    this.root.className = 'ball-labels';
    this.root.innerHTML =
      '<svg aria-hidden="true"><path class="aim-outline"/><path class="aim-line"/><circle class="active-ball-ring"/></svg><span class="ball-tag blue" hidden></span><span class="ball-tag amber" hidden></span>';
    this.labels = Array.from(this.root.querySelectorAll('span'));
    this.svg = this.root.querySelector('svg')!;
    this.line = this.root.querySelector('.aim-line')!;
    this.outline = this.root.querySelector('.aim-outline')!;
    container.append(this.root);
  }
  update(
    camera: THREE.Camera,
    width: number,
    height: number,
    names: [string, string] | null,
    balls: (THREE.Vector3 | null)[],
    active: number,
    aiming: boolean,
    arrow: THREE.Vector3[] | null,
  ) {
    const project = (v: THREE.Vector3) => {
      const p = v.clone().project(camera);
      return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2, z: p.z };
    };
    this.labels.forEach((label, i) => {
      const ball = balls[i];
      const p = ball && project(ball);
      label.hidden =
        !names || !p || p.z < -1 || p.z > 1 || p.x < 0 || p.x > width || p.y < 0 || p.y > height;
      if (label.hidden || !p || !names) return;
      const text = names[i] + (i === active && aiming ? ' · 出手' : '');
      if (label.textContent !== text) label.textContent = text;
      label.classList.toggle('current', i === active && aiming);
      label.style.left = `${Math.max(4, Math.min(width - 100, p.x + 18))}px`;
      label.style.top = `${Math.max(14, p.y - 10)}px`;
    });
    const ring = this.svg.querySelector('circle')!;
    const activeBall = balls[active];
    ring.setAttribute('visibility', names && aiming && activeBall ? 'visible' : 'hidden');
    if (activeBall) {
      const p = project(activeBall);
      const edge = project(activeBall.clone().add(new THREE.Vector3(0.05, 0, 0)));
      ring.setAttribute('cx', String(p.x));
      ring.setAttribute('cy', String(p.y));
      ring.setAttribute('r', String(Math.max(7, Math.abs(edge.x - p.x) + 2)));
    }
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    let d = '';
    if (arrow) {
      const [a, b] = arrow.map(project);
      const angle = Math.atan2(b.y - a.y, b.x - a.x),
        r = 9;
      d = `M${a.x},${a.y}L${b.x},${b.y}M${b.x - r * Math.cos(angle - 0.5)},${b.y - r * Math.sin(angle - 0.5)}L${b.x},${b.y}L${b.x - r * Math.cos(angle + 0.5)},${b.y - r * Math.sin(angle + 0.5)}`;
    }
    this.line.setAttribute('d', d);
    this.outline.setAttribute('d', d);
  }
  dispose() {
    this.root.remove();
  }
}
