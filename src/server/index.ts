import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initPhysics } from '../shared/physics';
import { MarbleRoom } from './room';
export async function createGameServer() {
  await initPhysics();
  const app = express();
  const http = createServer(app);
  app.get('/health', (_req, res) => res.json({ ok: true, game: 'danzhu', version: '0.1.0' }));
  app.use(express.static(resolve('dist/client')));
  const server = new Server({
    transport: new WebSocketTransport({ server: http }),
    greet: false,
    gracefullyShutdown: false,
  });
  server.define('marble', MarbleRoom);
  return { server, http };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server } = await createGameServer();
  const port = Number(process.env.PORT || 2567);
  await server.listen(port, '0.0.0.0');
  console.log(`Marble server ready: http://localhost:${port}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => void server.gracefullyShutdown(false).then(() => process.exit(0)));
}
