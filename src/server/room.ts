import { Room, type Client } from '@colyseus/core';
import { randomBytes } from 'node:crypto';
import { MarbleGame } from '../shared/game';
import { CONFIG, MAP_VERSION, PROTOCOL_VERSION } from '../shared/map';
import type { Player, Presence } from '../shared/types';
export class MarbleRoom extends Room {
  maxClients = 2;
  private game!: MarbleGame;
  private seats = new Map<string, Player>();
  private connected: [boolean, boolean] = [false, false];
  private ready: [boolean, boolean] = [false, false];
  private rematch: [boolean, boolean] = [false, false];
  private started = false;
  private accumulator = 0;
  private broadcastTime = 0;
  private lastActivity = Date.now();
  onCreate() {
    this.roomId = randomBytes(4).toString('hex').toUpperCase();
    this.game = new MarbleGame();
    this.onMessage('sync', (client) => this.sendState(client));
    this.onMessage('ready', (client) => {
      const p = this.seats.get(client.sessionId);
      if (p === undefined || this.started) return;
      this.ready[p] = true;
      this.lastActivity = Date.now();
      this.maybeStart();
      this.sendAll();
    });
    this.onMessage('shot', (client, shot) => {
      const p = this.seats.get(client.sessionId);
      const result =
        p === undefined || !this.started || !this.connected.every(Boolean)
          ? { ok: false, error: '等待双方连接并准备' }
          : this.game.shoot(p, shot);
      client.send('action', result);
      if (result.ok) {
        this.lastActivity = Date.now();
        this.sendAll();
      }
    });
    this.onMessage('rematch', (client) => {
      const p = this.seats.get(client.sessionId);
      if (p === undefined || this.game.snapshot().phase !== 'finished') return;
      this.rematch[p] = true;
      this.lastActivity = Date.now();
      this.maybeStart();
      this.sendAll();
    });
    this.setSimulationInterval((milliseconds) => {
      if (this.started) {
        this.accumulator += milliseconds / 1000;
        let steps = 0;
        while (this.accumulator >= CONFIG.dt && steps < 30) {
          this.game.tick(CONFIG.dt, !this.connected.every(Boolean));
          this.accumulator -= CONFIG.dt;
          steps++;
        }
        if (this.accumulator > 0.5) {
          this.game.finish({ winner: null, reason: 'physics', time: this.game.snapshot().time });
          this.accumulator = 0;
        }
      }
      this.broadcastTime += milliseconds;
      if (this.broadcastTime >= 50) {
        this.broadcastTime = 0;
        this.sendAll();
      }
      const phase = this.game.snapshot().phase;
      if (
        (!this.started && Date.now() - this.lastActivity > 600000) ||
        (phase === 'finished' && Date.now() - this.lastActivity > 300000)
      )
        void this.disconnect();
    }, 1000 / 60);
  }
  onJoin(client: Client, options: { mapVersion?: string; protocolVersion?: number } = {}) {
    if (options.mapVersion !== MAP_VERSION || options.protocolVersion !== PROTOCOL_VERSION)
      throw new Error('游戏版本不一致，请刷新页面');
    const used = new Set(this.seats.values());
    const p: Player = used.has(0) ? 1 : 0;
    if (used.has(p)) throw new Error('房间已满');
    this.seats.set(client.sessionId, p);
    this.connected[p] = true;
    this.lastActivity = Date.now();
    this.sendAll();
  }
  async onDrop(client: Client) {
    const p = this.seats.get(client.sessionId);
    if (p === undefined) return;
    this.connected[p] = false;
    this.sendAll();
    try {
      await this.allowReconnection(client, 30);
    } catch {
      /* onLeave handles expired reservation. */
    }
  }
  onReconnect(client: Client) {
    const p = this.seats.get(client.sessionId);
    if (p !== undefined) {
      this.connected[p] = true;
      this.maybeStart();
      this.sendAll();
    }
  }
  onLeave(client: Client) {
    const p = this.seats.get(client.sessionId);
    if (p === undefined) return;
    this.connected[p] = false;
    if (this.started) {
      this.game.forfeit(p);
    } else {
      this.seats.delete(client.sessionId);
      this.ready[p] = false;
    }
    this.sendAll();
    if (!this.connected.some(Boolean)) void this.disconnect();
  }
  private maybeStart() {
    if (!this.connected.every(Boolean)) return;
    if (!this.started && this.ready.every(Boolean)) {
      this.started = true;
      void this.lock();
    }
    if (this.started && this.game.snapshot().phase === 'finished' && this.rematch.every(Boolean)) {
      this.game.reset();
      this.rematch = [false, false];
    }
  }
  private sendState(client: Client) {
    const player = this.seats.get(client.sessionId);
    if (player === undefined) return;
    const presence: Presence = {
      code: this.roomId,
      player,
      connected: [...this.connected],
      ready: [...this.ready],
      rematch: [...this.rematch],
      started: this.started,
    };
    client.send('presence', presence);
    client.send('snapshot', this.game.snapshot());
  }
  private sendAll() {
    for (const client of this.clients) this.sendState(client);
  }
  onDispose() {
    this.game.dispose();
  }
}
