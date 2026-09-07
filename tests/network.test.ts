import { afterAll, beforeAll, it, expect } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { createGameServer } from '../src/server/index';
import { MAP_VERSION, PROTOCOL_VERSION } from '../src/shared/map';
import type { GameSnapshot, Presence } from '../src/shared/types';
const version = { mapVersion: MAP_VERSION, protocolVersion: PROTOCOL_VERSION };
let server: Awaited<ReturnType<typeof createGameServer>>, port: number;
const rooms: Room[] = [];
beforeAll(async () => {
  server = await createGameServer();
  await server.server.listen(0, '127.0.0.1');
  port = (server.http.address() as { port: number }).port;
});
afterAll(async () => {
  await Promise.all(rooms.filter((r) => r.connection.isOpen).map((r) => r.leave().catch(() => {})));
  await server.server.gracefullyShutdown(false);
});
function waitMessage<T>(
  r: Room,
  type: string,
  predicate: (s: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out ${type}`)), 5000);
    const off = r.onMessage(type, (s: T) => {
      if (predicate(s)) {
        clearTimeout(timer);
        off();
        resolve(s);
      }
    });
  });
}
it('two real clients join, ready, serve and receive same authoritative state', async () => {
  const client = new Client(`http://127.0.0.1:${port}`),
    a = await client.create('marble', version);
  rooms.push(a);
  a.onMessage('presence', () => {});
  a.onMessage('snapshot', () => {});
  a.onMessage('action', () => {});
  const b = await client.joinById(a.roomId, version);
  rooms.push(b);
  b.onMessage('presence', () => {});
  b.onMessage('snapshot', () => {});
  b.onMessage('action', () => {});
  const ready = waitMessage<Presence>(a, 'presence', (p) => p.started);
  a.send('ready');
  b.send('ready');
  await ready;
  const stateWait = waitMessage<GameSnapshot>(a, 'snapshot');
  a.send('sync');
  const s = await stateWait;
  const actor = s.active === 0 ? a : b;
  const movedA = waitMessage<GameSnapshot>(a, 'snapshot', (x) => x.phase === 'moving');
  const movedB = waitMessage<GameSnapshot>(b, 'snapshot', (x) => x.phase === 'moving');
  actor.send('shot', {
    id: 'test-shot',
    match: s.match,
    turn: s.turn,
    power: 0.12,
    serveX: 0.5,
    direction: { x: 0, z: -1 },
  });
  const [sa, sb] = await Promise.all([movedA, movedB]);
  expect(sa.active).toBe(sb.active);
  expect(sa.balls).toEqual(sb.balls);
  expect(sa.served[sa.active]).toBe(true);
  await expect(client.joinById(a.roomId, version)).rejects.toThrow();
  const invalid = waitMessage<{ ok: boolean }>(actor, 'action');
  actor.send('shot', { id: 'invalid', power: Infinity });
  expect((await invalid).ok).toBe(false);
}, 15000);
it('ready consensus is reevaluated after reconnect', async () => {
  const c = new Client(`http://127.0.0.1:${port}`),
    a = await c.create('marble', version);
  rooms.push(a);
  a.onMessage('*', () => {});
  const b = await c.joinById(a.roomId, version);
  rooms.push(b);
  b.onMessage('*', () => {});
  const readyA = waitMessage<Presence>(b, 'presence', (p) => p.ready[0]);
  a.send('ready');
  await readyA;
  const dropped = waitMessage<Presence>(b, 'presence', (p) => !p.connected[0]);
  a.reconnection.enabled = false;
  const token = a.reconnectionToken;
  a.connection.close(1000);
  await dropped;
  const readyB = waitMessage<Presence>(b, 'presence', (p) => p.ready[1]);
  b.send('ready');
  await readyB;
  const started = waitMessage<Presence>(b, 'presence', (p) => p.started);
  const restored = await c.reconnect(token);
  rooms.push(restored);
  restored.onMessage('*', () => {});
  expect((await started).connected).toEqual([true, true]);
}, 15000);
