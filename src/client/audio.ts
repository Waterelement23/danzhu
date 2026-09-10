import type { BallState, GameSnapshot, GameSound, Vec3 } from '../shared/types';
import { AudioTimeline } from './audio-timeline';
import { ChargeMotion } from './charge-motion';
import { ChargeAudio } from './charge-audio';

export type AudioFrame = {
  time: number;
  fresh: boolean;
  balls: BallState[];
  listener: Vec3;
  forward: Vec3;
  up: Vec3;
};
type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan: PannerNode };
const COUNTS = { earth: 3, marble: 8, stone: 8 };
const ROOT = `${import.meta.env.BASE_URL}audio/`;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export function rollingLevel(ball: BallState): number {
  if (!ball.grounded || !Number.isFinite(ball.rollingSpeed) || ball.rollingSpeed! < 0.025) return 0;
  return clamp(Math.sqrt(ball.rollingSpeed! / 1.4) * 2.5, 0, 3.2);
}

/** Client-only effects; never influences simulation or victory adjudication. */
export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading?: Promise<void>;
  private timeline = new AudioTimeline();
  private chargeMotion = new ChargeMotion();
  private charge?: ChargeAudio;
  private rolls = new Map<number, Voice>();
  private impacts = new Set<Voice>();
  private variants = new Map<string, number>();
  private disposed = false;
  private hidden = document.hidden;
  private muted = false;
  private volume = 0.7;
  private ready = false;
  private error = false;
  private played = { earth: 0, marble: 0, stone: 0, launch: 0 };
  public onChange?: () => void;
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem('danzhu-audio') ?? 'null');
      if (typeof saved?.muted === 'boolean') this.muted = saved.muted;
      if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume))
        this.volume = clamp(saved.volume, 0, 1);
    } catch {
      /* Private storage must not block gameplay. */
    }
    document.addEventListener('visibilitychange', this.visibility);
  }
  get state() {
    return {
      muted: this.muted,
      volume: this.volume,
      status: this.error ? 'error' : this.ready ? 'ready' : this.loading ? 'loading' : 'locked',
      running: this.context?.state === 'running',
      rollingVoices: this.rolls.size,
      impactVoices: this.impacts.size,
      chargeVoices: this.charge?.count ?? 0,
      played: { ...this.played },
    };
  }
  private save() {
    try {
      localStorage.setItem(
        'danzhu-audio',
        JSON.stringify({ muted: this.muted, volume: this.volume }),
      );
    } catch {
      /* optional */
    }
    this.applyMaster();
    this.onChange?.();
  }
  setMuted(value: boolean) {
    this.muted = value;
    if (value) {
      this.stopVoices();
      this.timeline.discard();
    }
    this.save();
  }
  setVolume(value: number) {
    this.volume = clamp(value, 0, 1);
    this.save();
  }
  private applyMaster() {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.muted || this.hidden ? 0 : this.volume,
        this.context.currentTime,
        0.025,
      );
  }
  /** Called synchronously inside a gesture; no audio fetch/decoding delays scene startup. */
  unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.context.destination);
      }
      if (!this.hidden)
        void this.context.resume().catch(() => {
          /* next gesture retries */
        });
      if (this.ready || this.loading) return;
      this.error = false;
      const ctx = this.context;
      const keys = [
        'roll-b',
        'charge',
        'launch',
        ...Object.entries(COUNTS).flatMap(([kind, count]) =>
          Array.from({ length: count }, (_, i) => `${kind}-${String(i + 1).padStart(2, '0')}`),
        ),
      ];
      this.loading = Promise.all(
        keys.map(async (key) => {
          const response = await fetch(`${ROOT}${key}.wav`);
          if (!response.ok) throw new Error(`Audio asset ${key}: ${response.status}`);
          const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
          if (!this.disposed) this.buffers.set(key, buffer);
        }),
      )
        .then(() => {
          if (!this.disposed) this.ready = true;
        })
        .catch(() => {
          this.error = true;
          this.ready = false;
        })
        .finally(() => {
          this.loading = undefined;
          this.onChange?.();
        });
      this.onChange?.();
    } catch {
      this.error = true;
      this.onChange?.();
    }
  }
  ingest(snapshot: GameSnapshot) {
    if (this.timeline.ingest(snapshot)) this.stopVoices();
  }
  beginCharge(power = 0) {
    this.endCharge();
    this.chargeMotion.begin(power);
  }
  chargeTo(power: number) {
    this.chargeMotion.move(power, performance.now());
    if (this.chargeMotion.level(performance.now()) === 0) this.charge?.stop();
  }
  endCharge() {
    this.chargeMotion.end();
    this.charge?.stop();
  }
  reset() {
    this.stopVoices();
    this.timeline.reset();
  }
  private makeVoice(buffer: AudioBuffer, loop: boolean): Voice {
    const ctx = this.context!;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      pan = ctx.createPanner();
    source.buffer = buffer;
    source.loop = loop;
    // Actual camera pose provides a fixed spectator viewpoint, not per-turn flipping.
    pan.panningModel = 'equalpower';
    pan.distanceModel = 'inverse';
    pan.refDistance = 5;
    pan.maxDistance = 30;
    pan.rolloffFactor = 0.8;
    gain.gain.value = 0;
    source.connect(gain).connect(pan).connect(this.master!);
    const voice = { source, gain, pan };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.impacts.delete(voice);
    };
    return voice;
  }
  private position(voice: Voice, p: Vec3) {
    const now = this.context!.currentTime;
    voice.pan.positionX.setTargetAtTime(p.x, now, 0.015);
    voice.pan.positionY.setTargetAtTime(p.y, now, 0.015);
    voice.pan.positionZ.setTargetAtTime(p.z, now, 0.015);
  }
  private stop(voice: Voice) {
    const now = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.015);
    try {
      voice.source.stop(now + 0.08);
    } catch {
      /* already stopped */
    }
  }
  private stopVoices() {
    this.endCharge();
    this.rolls.forEach((v) => this.stop(v));
    this.rolls.clear();
    this.impacts.forEach((v) => this.stop(v));
    this.impacts.clear();
  }
  private impact(sound: GameSound) {
    if (this.impacts.size >= 12) return;
    let key = 'launch';
    if (sound.kind !== 'launch') {
      const count = COUNTS[sound.kind];
      const previous = this.variants.get(sound.kind) ?? -1;
      const choice = (previous + 1 + Math.floor(Math.random() * (count - 1))) % count;
      this.variants.set(sound.kind, choice);
      key = `${sound.kind}-${String(choice + 1).padStart(2, '0')}`;
    }
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const voice = this.makeVoice(buffer, false);
    this.position(voice, sound.position);
    // Normal approach speed encodes severity; grazing and weak contacts stay quiet.
    voice.gain.gain.value =
      sound.kind === 'launch'
        ? 0.6 + 0.5 * sound.power
        : clamp(Math.sqrt(sound.speed / 3) * 0.75, 0.06, 0.9);
    this.impacts.add(voice);
    this.played[sound.kind]++;
    voice.source.start();
  }
  update(frame: AudioFrame, active: boolean) {
    if (this.disposed) return;
    const audible =
      active &&
      frame.fresh &&
      !this.hidden &&
      !this.muted &&
      this.volume > 0 &&
      this.ready &&
      this.context?.state === 'running';
    const due = this.timeline.poll(frame.time, !!audible);
    if (!audible) {
      this.stopVoices();
      return;
    }
    const ctx = this.context!,
      l = ctx.listener,
      now = ctx.currentTime;
    const pose = [
      l.positionX,
      l.positionY,
      l.positionZ,
      l.forwardX,
      l.forwardY,
      l.forwardZ,
      l.upX,
      l.upY,
      l.upZ,
    ];
    const values = [
      frame.listener.x,
      frame.listener.y,
      frame.listener.z,
      frame.forward.x,
      frame.forward.y,
      frame.forward.z,
      frame.up.x,
      frame.up.y,
      frame.up.z,
    ];
    pose.forEach((p, i) => p.setTargetAtTime(values[i], now, 0.015));
    due.forEach((sound) => this.impact(sound));
    const chargePower = this.chargeMotion.level(performance.now());
    if (chargePower > 0 && !this.charge)
      this.charge = new ChargeAudio(ctx, this.master!, this.buffers.get('charge')!);
    this.charge?.update(chargePower);
    for (const player of [0, 1]) {
      const ball = frame.balls.find((b) => b.player === player);
      const target = ball ? rollingLevel(ball) : 0;
      let voice = this.rolls.get(player);
      if (target === 0) {
        if (voice) {
          this.stop(voice);
          this.rolls.delete(player);
        }
        continue;
      }
      if (!voice) {
        voice = this.makeVoice(this.buffers.get('roll-b')!, true);
        this.rolls.set(player, voice);
        voice.source.start(now, Math.random() * voice.source.buffer!.duration);
      }
      this.position(voice, ball!.position);
      voice.gain.gain.setTargetAtTime(target, now, 0.06);
      voice.source.playbackRate.setTargetAtTime(
        clamp(0.8 + ball!.rollingSpeed! * 0.16, 0.8, 1.3),
        now,
        0.12,
      );
    }
  }
  private visibility = () => {
    this.hidden = document.hidden;
    this.timeline.discard();
    this.stopVoices();
    this.applyMaster();
    if (this.hidden) void this.context?.suspend().catch(() => {});
    else if (this.context) void this.context.resume().catch(() => {});
  };
  dispose() {
    this.disposed = true;
    this.reset();
    document.removeEventListener('visibilitychange', this.visibility);
    this.buffers.clear();
    void this.context?.close().catch(() => {});
  }
}
