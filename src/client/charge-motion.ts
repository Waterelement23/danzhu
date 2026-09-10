/** Local gesture state, independent from snapshots and their redraw frequency. */
export class ChargeMotion {
  private active = false;
  private power = 0;
  private until = -Infinity;
  begin(power = 0) {
    this.active = true;
    this.power = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : 0;
    this.until = -Infinity;
  }
  move(power: number, now: number) {
    if (!this.active) return;
    if (!Number.isFinite(power)) {
      this.end();
      return;
    }
    power = Math.max(0, Math.min(1, power));
    const delta = power - this.power;
    // Accumulate very small movements; unchanged direction/power never extends the sound.
    if (Math.abs(delta) < 0.0001) return;
    this.power = power;
    this.until = delta > 0 ? now + 90 : -Infinity;
  }
  level(now: number) {
    return this.active && now < this.until ? this.power : 0;
  }
  end() {
    this.active = false;
    this.until = -Infinity;
  }
}
