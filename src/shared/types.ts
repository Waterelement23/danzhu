export type Player = 0 | 1;
export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };
export type Phase = 'aiming' | 'moving' | 'shrinking' | 'finished';
export type Shot = {
  id: string;
  match: number;
  turn: number;
  direction: { x: number; z: number };
  power: number;
  serveX?: number;
};
export type BallState = {
  player: Player;
  position: Vec3;
  rotation: Quat;
  velocity: Vec3;
  /** Authoritative support and tangential speed; never inferred from screen motion. */
  grounded?: boolean;
  rollingSpeed?: number;
};
export type ImpactSound = {
  id: number;
  time: number;
  kind: 'earth' | 'stone' | 'marble';
  player: Player;
  position: Vec3;
  speed: number;
};
export type LaunchSound = {
  id: number;
  time: number;
  kind: 'launch';
  player: Player;
  position: Vec3;
  power: number;
};
export type GameSound = ImpactSound | LaunchSound;
export type Result = {
  winner: Player | null;
  reason: 'hit' | 'out' | 'shrink' | 'timeout' | 'draw' | 'physics' | 'disconnect' | 'serve';
  time: number;
};
export type GameSnapshot = {
  sounds?: GameSound[];
  terrainSeed: number;
  mapVersion: string;
  protocolVersion: number;
  match: number;
  turn: number;
  round: number;
  active: Player;
  first: Player;
  phase: Phase;
  served: [boolean, boolean];
  balls: BallState[];
  boundary: number;
  nextBoundary: number;
  secondsLeft: number;
  time: number;
  result: Result | null;
};
export type Presence = {
  code: string;
  player: Player;
  connected: [boolean, boolean];
  ready: [boolean, boolean];
  rematch: [boolean, boolean];
  started: boolean;
};
export type ActionResult = { ok: true } | { ok: false; error: string };
