/** Consume each second even while hidden/inactive so no warning is replayed later. */
export class TurnCountdown {
  private key = '';
  private lowest = Infinity;
  update(key: string, seconds: number, active: boolean, visible: boolean) {
    if (key !== this.key) {
      this.key = key;
      this.lowest = Infinity;
    }
    const number = Math.ceil(seconds);
    if (!Number.isFinite(number)) return { number: null, beep: false };
    const fresh = number < this.lowest;
    this.lowest = Math.min(this.lowest, number);
    const show = active && visible && number >= 1 && number <= 10;
    return { number: show ? number : null, beep: show && fresh };
  }
}
