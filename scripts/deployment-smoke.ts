import assert from 'node:assert/strict';
import { Client, type Room } from '@colyseus/sdk';
import { MAP_VERSION, PROTOCOL_VERSION } from '../src/shared/map';
import type { GameSnapshot, Presence } from '../src/shared/types';

// Creates only a temporary two-player verification room and closes both clients.
const base = new URL(process.argv[2] || 'http://127.0.0.1:2567/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const rooms: Room[] = [];
const deadline = setTimeout(() => {
  console.error('Deployment verification exceeded 45 seconds');
  process.exit(1);
}, 45000);
function message<T>(room: Room, type: string, predicate: (data: T) => boolean = () => true) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`Timed out: ${type}`));
    }, 10000);
    const off = room.onMessage(type, (data: T) => {
      if (predicate(data)) {
        clearTimeout(timer);
        off();
        resolve(data);
      }
    });
  });
}
try {
  const health = await fetch(new URL('health', base));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).game, 'danzhu');
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  const script = html.match(/<script[^>]+src="([^"]+)"/);
  assert.ok(script, 'production script exists');
  assert.ok(script[1].startsWith(`${base.pathname}assets/`), 'script uses deployment prefix');
  for (const path of [
    script[1],
    'models/refined-courtyard.glb',
    'audio/charge.wav',
    'audio/launch.wav',
  ]) {
    const response = await fetch(new URL(path, base), { method: 'HEAD' });
    assert.equal(response.status, 200, `asset: ${path}`);
  }
  const client = new Client(base.href);
  const version = { mapVersion: MAP_VERSION, protocolVersion: PROTOCOL_VERSION };
  const a = await client.create('marble', version);
  rooms.push(a);
  a.onMessage('*', () => {});
  const b = await client.joinById(a.roomId, version);
  rooms.push(b);
  b.onMessage('*', () => {});
  const ready = message<Presence>(a, 'presence', (p) => p.started);
  a.send('ready');
  b.send('ready');
  await ready;
  const initial = message<GameSnapshot>(a, 'snapshot');
  a.send('sync');
  const state = await initial;
  const fromA = message<GameSnapshot>(a, 'snapshot', (s) => s.phase === 'moving');
  const fromB = message<GameSnapshot>(b, 'snapshot', (s) => s.phase === 'moving');
  const landingA = message<GameSnapshot>(
    a,
    'snapshot',
    (s) => !!s.sounds?.some((e) => e.kind === 'earth'),
  );
  const landingB = message<GameSnapshot>(
    b,
    'snapshot',
    (s) => !!s.sounds?.some((e) => e.kind === 'earth'),
  );
  (state.active === 0 ? a : b).send('shot', {
    id: 'deployment-smoke',
    match: state.match,
    turn: state.turn,
    power: 0.12,
    serveX: 0.5,
    direction: { x: 0, z: -1 },
  });
  const [sa, sb] = await Promise.all([fromA, fromB]);
  assert.deepEqual(sa.balls, sb.balls);
  assert.equal(sa.terrainSeed, sb.terrainSeed);
  assert.equal(sa.sounds?.filter((e) => e.kind === 'launch').length, 1);
  const [la, lb] = await Promise.all([landingA, landingB]);
  assert.deepEqual(la.sounds, lb.sounds);
  console.log(
    JSON.stringify(
      {
        passed: true,
        url: base.href,
        checks: [
          'health',
          'subpath assets',
          'HTTPS matchmaking',
          'two WebSocket connections',
          'ready consensus',
          'identical terrain and ball state',
          'launch and landing sound events',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await Promise.all(
    rooms.map((r) => {
      r.reconnection.enabled = false;
      return r.leave().catch(() => {});
    }),
  );
  clearTimeout(deadline);
}
