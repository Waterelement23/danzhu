import { CONFIG, SERVE_RANGE, SERVE_Z, MAP_VERSION, PROTOCOL_VERSION } from './map';
import { MarblePhysics } from './physics';
import type { ActionResult, GameSnapshot, Player, Result, Shot } from './types';
const other = (p: Player) => (1 - p) as Player;
export class MarbleGame {
  physics: MarblePhysics;
  private state: Omit<GameSnapshot, 'balls' | 'nextBoundary' | 'mapVersion' | 'protocolVersion'>;
  private seen = new Set<string>();
  private stable = 0;
  private motion = 0;
  private shrinkDelay = 0;
  private timeouts: [number, number] = [0, 0];
  private entered = false;
  private afterResult = 0;
  constructor(first: Player = Math.random() < 0.5 ? 0 : 1, match = 1) {
    this.physics = new MarblePhysics();
    this.state = {
      match,
      turn: 1,
      round: 1,
      active: first,
      first,
      phase: 'aiming',
      served: [false, false],
      boundary: CONFIG.half,
      secondsLeft: CONFIG.aimSeconds,
      time: 0,
      result: null,
    };
  }
  private nextBoundary() {
    return this.state.round >= 4
      ? Math.max(CONFIG.half * 0.36, this.state.boundary - CONFIG.half * 0.08)
      : this.state.boundary;
  }
  snapshot(): GameSnapshot {
    return {
      ...this.state,
      mapVersion: MAP_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      served: [...this.state.served],
      result: this.state.result ? { ...this.state.result } : null,
      balls: this.physics.states(),
      nextBoundary: this.nextBoundary(),
    };
  }
  shoot(player: Player, raw: unknown): ActionResult {
    const fail = (error: string): ActionResult => ({ ok: false, error });
    if (this.state.phase !== 'aiming') return fail('请等待弹珠停稳');
    if (player !== this.state.active) return fail('还没轮到你');
    if (!raw || typeof raw !== 'object') return fail('无效的击球指令');
    const s = raw as Shot;
    if (typeof s.id !== 'string' || s.id.length < 1 || s.id.length > 80 || this.seen.has(s.id))
      return fail('重复或无效的操作');
    if (s.match !== this.state.match || s.turn !== this.state.turn)
      return fail('回合已变化，请重新瞄准');
    if (
      !s.direction ||
      !Number.isFinite(s.direction.x) ||
      !Number.isFinite(s.direction.z) ||
      !Number.isFinite(s.power) ||
      s.power < 0 ||
      s.power > 1
    )
      return fail('方向或力度无效');
    const norm = Math.hypot(s.direction.x, s.direction.z);
    if (norm < 0.0001 || norm > 2) return fail('方向无效');
    const direction = { x: s.direction.x / norm, z: s.direction.z / norm };
    const serving = !this.state.served[player];
    if (serving) {
      if (!Number.isFinite(s.serveX) || Math.abs(s.serveX!) > SERVE_RANGE)
        return fail('请选择发球线上的位置');
      if (direction.z >= -0.01) return fail('请朝场地内发球');
      if (
        this.physics
          .states()
          .some(
            (b) =>
              Math.hypot(b.position.x - s.serveX!, b.position.z - SERVE_Z) <=
              2 * CONFIG.radius + 0.002,
          )
      )
        return fail('发球点离对方太近，请换个位置');
      this.physics.serve(player, s.serveX!, player === this.state.first, direction, s.power);
      this.state.served[player] = true;
    } else if (!this.physics.strike(player, direction, s.power)) return fail('弹珠尚未稳定接地');
    this.entered = !serving;
    this.seen.add(s.id);
    this.timeouts[player] = 0;
    this.motion = 0;
    this.stable = 0;
    this.state.phase = 'moving';
    this.state.secondsLeft = 0;
    return { ok: true };
  }
  tick(dt: number, paused = false) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.state.time += dt;
    if (this.state.phase === 'finished') {
      if (this.afterResult < 8 && !this.physics.settled()) {
        this.physics.step(Math.min(dt, CONFIG.dt), 100, this.state.active, { adjudicate: false });
        this.afterResult += dt;
      }
      return;
    }
    if (this.state.phase === 'moving') {
      const startTime = this.state.time - dt;
      const event = this.physics.step(
        Math.min(dt, CONFIG.dt),
        this.state.boundary,
        this.state.active,
      );
      if (event) {
        this.finish({ ...event, time: startTime + event.time });
        return;
      }
      const activeBall = this.physics.states().find((b) => b.player === this.state.active)!;
      if (activeBall.position.z < this.state.boundary - 0.0001) this.entered = true;
      this.motion += dt;
      if (this.physics.settled()) this.stable += dt;
      else this.stable = 0;
      if (this.stable >= CONFIG.settleSeconds) {
        if (!this.entered) {
          this.finish({ winner: other(this.state.active), reason: 'serve', time: this.state.time });
          return;
        }
        this.nextTurn();
      } else if (this.motion > CONFIG.maxMotion)
        this.finish({ winner: null, reason: 'physics', time: this.state.time });
      return;
    }
    if (paused) return;
    if (this.state.phase === 'shrinking') {
      this.shrinkDelay -= dt;
      if (this.shrinkDelay <= 0) this.state.phase = 'aiming';
      return;
    }
    this.state.secondsLeft = Math.max(0, this.state.secondsLeft - dt);
    if (this.state.secondsLeft === 0) {
      const p = this.state.active;
      this.timeouts[p]++;
      if (!this.state.served[p] || this.timeouts[p] >= 2)
        this.finish({ winner: other(p), reason: 'timeout', time: this.state.time });
      else this.nextTurn();
    }
  }
  private nextTurn() {
    const completedRound = this.state.active !== this.state.first;
    this.state.active = other(this.state.active);
    this.state.turn++;
    this.state.secondsLeft = CONFIG.aimSeconds;
    this.state.phase = 'aiming';
    if (completedRound) {
      const next = this.nextBoundary();
      if (next < this.state.boundary) {
        this.state.boundary = next;
        const outside = this.physics
          .states()
          .filter((b) => Math.max(Math.abs(b.position.x), Math.abs(b.position.z)) > next);
        if (outside.length) {
          this.finish({
            winner: outside.length === 2 ? null : other(outside[0].player),
            reason: 'shrink',
            time: this.state.time,
          });
          return;
        }
        this.state.phase = 'shrinking';
        this.shrinkDelay = 0.65;
      }
      if (this.state.round >= CONFIG.maxRounds) {
        this.finish({ winner: null, reason: 'draw', time: this.state.time });
        return;
      }
      this.state.round++;
    }
  }
  finish(result: Result) {
    if (this.state.result) return;
    this.state.result = result;
    this.state.phase = 'finished';
    this.state.secondsLeft = 0;
    this.afterResult = 0;
  }
  forfeit(player: Player) {
    this.finish({ winner: other(player), reason: 'disconnect', time: this.state.time });
  }
  reset() {
    const first = other(this.state.first),
      match = this.state.match + 1;
    this.physics.dispose();
    this.physics = new MarblePhysics();
    this.state = {
      match,
      turn: 1,
      round: 1,
      active: first,
      first,
      phase: 'aiming',
      served: [false, false],
      boundary: CONFIG.half,
      secondsLeft: CONFIG.aimSeconds,
      time: 0,
      result: null,
    };
    this.seen.clear();
    this.timeouts = [0, 0];
    this.stable = 0;
    this.motion = 0;
    this.afterResult = 0;
  }
  dispose() {
    this.physics.dispose();
  }
}
