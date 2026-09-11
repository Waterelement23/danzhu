/** Rendering budgets never alter the shared physics timestep or network tick. */
export function renderProfile(mobile: boolean) {
  return {
    mobile,
    fps: mobile ? 30 : 60,
    idleFps: mobile ? 15 : 30,
    pixelRatio: mobile ? 1.25 : 2,
    maxPixels: mobile ? 900000 : Infinity,
    shadowSize: mobile ? 2048 : 4096,
    reflectionSize: mobile ? 384 : 768,
    transmissionScale: mobile ? 0.5 : 1,
    causticSize: mobile ? 64 : 128,
    photons: mobile ? 256 : 512,
    sphereSegments: mobile ? 48 : 96,
  };
}
export function pixelRatioFor(
  profile: ReturnType<typeof renderProfile>,
  width: number,
  height: number,
  deviceRatio: number,
) {
  return Math.min(
    deviceRatio,
    profile.pixelRatio,
    Math.sqrt(profile.maxPixels / Math.max(1, width * height)),
  );
}
export class FramePacer {
  private last: number | null = null;
  private due = 0;
  constructor(
    private fps: number,
    private idleFps: number,
  ) {}
  reset() {
    this.last = null;
    this.due = 0;
  }
  take(now: number, active: boolean, hidden: boolean): number | null {
    if (hidden) {
      this.reset();
      return null;
    }
    const period = 1000 / (active ? this.fps : this.idleFps);
    if (this.last === null) {
      this.last = now;
      this.due = now + period;
      return 0;
    }
    this.due = Math.min(this.due, this.last + period);
    if (now + 0.1 < this.due) return null;
    const dt = (now - this.last) / 1000;
    const over = Math.max(0, now - this.due);
    this.due = now + period - (over % period);
    this.last = now;
    return dt;
  }
}
