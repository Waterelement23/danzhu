import type { GameSnapshot, GameSound } from '../shared/types';

/** Repeated network histories are consumed once, at the frame actually displayed. */
export class AudioTimeline {
  private match = '';
  private newest = -Infinity;
  private seen = 0;
  private pending: GameSound[] = [];
  ingest(snapshot: GameSnapshot) {
    const key = `${snapshot.match}:${snapshot.terrainSeed}`;
    if (key !== this.match) {
      this.reset();
      this.match = key;
      this.seen = Math.max(0, ...(snapshot.sounds ?? []).map((s) => s.id));
      this.newest = snapshot.time;
      return true; // Joining/rejoining a match never replays its history.
    }
    if (snapshot.time < this.newest) return false;
    this.newest = snapshot.time;
    for (const sound of snapshot.sounds ?? []) {
      if (sound.id <= this.seen) continue;
      this.seen = sound.id;
      this.pending.push(sound);
    }
    this.pending = this.pending.slice(-64);
    return false;
  }
  poll(time: number, audible: boolean) {
    const due = this.pending.filter((s) => s.time <= time);
    this.pending = this.pending.filter((s) => s.time > time);
    return audible ? due.filter((s) => time - s.time < 0.25) : [];
  }
  discard() {
    this.pending = [];
  }
  reset() {
    this.match = '';
    this.newest = -Infinity;
    this.seen = 0;
    this.pending = [];
  }
}
