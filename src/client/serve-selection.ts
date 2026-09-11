export type ServeSample = { x: number; y: number; worldX: number };
/** Pick the same projected polyline that the player sees, including rounded end caps. */
export function pickServePosition(
  point: { x: number; y: number },
  samples: ServeSample[],
  radius: number,
): number | null {
  let best = radius * radius,
    picked: number | null = null;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    if (!length) continue;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
    const distance = (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2;
    if (distance <= best) {
      best = distance;
      picked = a.worldX + (b.worldX - a.worldX) * t;
    }
  }
  return picked;
}
export class ServeTap {
  private candidate: number | null = null;
  private moved = false;
  get pending() {
    return this.candidate !== null && !this.moved;
  }
  begin(candidate: number | null) {
    this.candidate = candidate;
    this.moved = false;
  }
  move(distance: number) {
    if (distance >= 5) this.moved = true;
  }
  clear() {
    this.candidate = null;
    this.moved = false;
  }
  finish() {
    const selected = this.pending ? this.candidate : null;
    this.clear();
    return selected;
  }
}
