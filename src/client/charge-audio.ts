/** Short overlapping windows follow the pull through the approved texture.
 * No full recording loop, reversed cancellation or independent cancel sound. */
export class ChargeAudio {
  private voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
  private next = 0;
  constructor(
    private ctx: AudioContext,
    private output: AudioNode,
    private buffer: AudioBuffer,
  ) {}
  get count() {
    return this.voices.size;
  }
  update(power: number) {
    if (power <= 0) {
      this.stop();
      return;
    }
    const now = this.ctx.currentTime;
    if (now < this.next || this.voices.size >= 4) return;
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    source.buffer = this.buffer;
    const duration = 0.22;
    const offset = 0.02 + power * Math.max(0, this.buffer.duration - duration - 0.05);
    const level = 0.45 + 0.35 * power;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.055);
    gain.gain.setValueAtTime(level, now + duration - 0.065);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(gain).connect(this.output);
    const voice = { source, gain };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    source.start(now, offset, duration);
    this.next = now + 0.11;
  }
  stop() {
    const now = this.ctx.currentTime;
    for (const v of this.voices) {
      v.gain.gain.cancelAndHoldAtTime(now);
      v.gain.gain.linearRampToValueAtTime(0, now + 0.04);
      v.source.stop(now + 0.045);
    }
    this.voices.clear();
    this.next = 0;
  }
}
