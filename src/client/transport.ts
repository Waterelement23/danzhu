import { Client, type Room } from '@colyseus/sdk';
import {
  CONFIG,
  MAP_VERSION,
  PROTOCOL_VERSION,
  nextTerrainSeed,
  validTerrainSeed,
} from '../shared/map';
import type { GameSnapshot, Presence, Shot, Player, ActionResult } from '../shared/types';
export interface GameTransport {
  kind: 'practice' | 'online';
  shoot(shot: Shot): void;
  ready(): void;
  rematch(): void;
  dispose(): void;
  tick(dt: number): void;
}
export type Hooks = {
  snapshot: (s: GameSnapshot) => void;
  presence: (p: Presence) => void;
  error: (text: string) => void;
  connection: (text: string, connected: boolean) => void;
  action: () => void;
};
export async function practice(h: Hooks, terrainSeed = nextTerrainSeed()): Promise<GameTransport> {
  const [{ MarbleGame }, { initPhysics }] = await Promise.all([
    import('../shared/game'),
    import('../shared/physics'),
  ]);
  await initPhysics();
  let game = new MarbleGame(0, 1, terrainSeed),
    acc = 0;
  const send = () => h.snapshot(game.snapshot());
  send();
  h.connection('本机双人练习', true);
  return {
    kind: 'practice',
    shoot(s) {
      const result = game.shoot(game.snapshot().active, s);
      if (!result.ok) h.error(result.error);
      h.action();
      send();
    },
    ready() {},
    rematch() {
      game.reset();
      send();
    },
    dispose() {
      game.dispose();
    },
    tick(dt) {
      acc += Math.min(dt, 0.1);
      while (acc >= CONFIG.dt) {
        game.tick(CONFIG.dt);
        acc -= CONFIG.dt;
      }
      send();
    },
  };
}
const TOKEN = 'danzhu-reconnect';
export function hasSession() {
  return !!sessionStorage.getItem(TOKEN);
}
export async function online(
  h: Hooks,
  mode: 'create' | 'join' | 'resume',
  code = '',
  isCurrent: () => boolean = () => true,
): Promise<GameTransport> {
  const endpoint =
    import.meta.env.VITE_SERVER_URL ||
    (import.meta.env.DEV
      ? `${location.protocol}//${location.hostname}:2567`
      : new URL(import.meta.env.BASE_URL, location.origin).href);
  const client = new Client(endpoint);
  let room: Room;
  try {
    room =
      mode === 'create'
        ? await client.create('marble', {
            mapVersion: MAP_VERSION,
            protocolVersion: PROTOCOL_VERSION,
          })
        : mode === 'join'
          ? await client.joinById(code.trim().toUpperCase(), {
              mapVersion: MAP_VERSION,
              protocolVersion: PROTOCOL_VERSION,
            })
          : await client.reconnect(sessionStorage.getItem(TOKEN) || '');
  } catch (error) {
    if (mode === 'resume' && isCurrent()) sessionStorage.removeItem(TOKEN);
    throw error;
  }
  if (!isCurrent()) {
    room.reconnection.enabled = false;
    void room.leave();
    throw new Error('连接已取消');
  }
  let disposed = false;
  let verified = false;
  let reconnecting = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline = 0;
  const save = () => sessionStorage.setItem(TOKEN, room.reconnectionToken);
  const clearToken = () => {
    if (sessionStorage.getItem(TOKEN) === room.reconnectionToken) sessionStorage.removeItem(TOKEN);
  };
  // Own a cancellable retry timer; SDK's internal retry timeout has no public cancellation API.
  const recover = async () => {
    if (disposed) return;
    if (Date.now() >= deadline) {
      reconnecting = false;
      h.connection('连接未恢复，可返回大厅重试', false);
      return;
    }
    try {
      const restored = await client.reconnect(room.reconnectionToken);
      if (disposed) {
        restored.reconnection.enabled = false;
        void restored.leave();
        return;
      }
      room = restored;
      reconnecting = false;
      bind(room);
    } catch {
      if (!disposed) retryTimer = setTimeout(() => void recover(), 800);
    }
  };
  const bind = (current: Room) => {
    current.reconnection.enabled = false;
    verified = false;
    save();
    h.connection('正在同步房间…', false);
    const alive = () => !disposed && current === room;
    current.onMessage('snapshot', (s: GameSnapshot) => {
      if (!alive()) return;
      if (
        s.mapVersion !== MAP_VERSION ||
        s.protocolVersion !== PROTOCOL_VERSION ||
        !validTerrainSeed(s.terrainSeed)
      ) {
        disposed = true;
        clearTimeout(retryTimer);
        clearToken();
        void current.leave();
        h.connection('游戏版本不一致，请刷新后重新开局', false);
        h.error('无法恢复不同版本的对局');
        return;
      }
      if (!verified) {
        verified = true;
        h.connection('已连接房间', true);
      }
      h.snapshot(s);
    });
    current.onMessage('presence', (p: Presence) => {
      if (alive()) h.presence(p);
    });
    current.onMessage('action', (a: ActionResult) => {
      if (!alive()) return;
      h.action();
      if (!a.ok) h.error(a.error);
    });
    current.onError((_code, message) => {
      if (alive() && !reconnecting) h.error(message || '连接出现问题');
    });
    current.onLeave((code) => {
      if (!alive()) return;
      verified = false;
      if (code === 4000) {
        clearToken();
        h.connection('已离开房间，请返回大厅', false);
        return;
      }
      h.connection('连接中断，正在重连…', false);
      if (!reconnecting) {
        reconnecting = true;
        deadline = Date.now() + 29000;
        retryTimer = setTimeout(() => void recover(), 300);
      }
    });
    current.send('sync');
  };
  bind(room);
  return {
    kind: 'online',
    shoot(s) {
      if (!disposed && verified && room.connection.isOpen) room.send('shot', s);
    },
    ready() {
      if (!disposed && verified && room.connection.isOpen) room.send('ready');
    },
    rematch() {
      if (!disposed && verified && room.connection.isOpen) room.send('rematch');
    },
    dispose() {
      disposed = true;
      clearTimeout(retryTimer);
      room.reconnection.enabled = false;
      if (room.connection.isOpen) {
        clearToken();
        void room.leave();
      }
    },
    tick() {},
  };
}

export function localPlayer(
  p: Presence | null,
  s: GameSnapshot,
  kind: 'practice' | 'online',
): Player {
  return kind === 'practice' ? s.active : (p?.player ?? 0);
}
