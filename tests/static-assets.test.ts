import { afterAll, beforeAll, expect, it } from 'vitest';
import express from 'express';
import { createServer, get } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { staticAssets } from '../src/server/static-assets';

const root = mkdtempSync(join(tmpdir(), '.danzhu-static-'));
const content = Buffer.from('model content '.repeat(100));
const version = createHash('sha256').update(content).digest('hex').slice(0, 12);
let server: ReturnType<typeof createServer>, base: string;
beforeAll(async () => {
  mkdirSync(join(root, 'models'));
  mkdirSync(join(root, 'assets'));
  for (const name of ['models/court.glb', 'assets/main-abcdefgh.js']) {
    writeFileSync(join(root, name), content);
    writeFileSync(join(root, `${name}.br`), brotliCompressSync(content));
    writeFileSync(join(root, `${name}.gz`), gzipSync(content));
  }
  writeFileSync(join(root, 'index.html'), '<html>ready</html>');
  const app = express();
  app.use(staticAssets(root));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(root, { recursive: true });
});
it('serves precompressed assets with decoded size and correct type', async () => {
  for (const [accept, encoding] of [
    ['br', 'br'],
    ['gzip', 'gzip'],
    ['gzip, deflate, br', 'br'],
  ]) {
    const r = await fetch(`${base}/models/court.glb`, { headers: { 'Accept-Encoding': accept } });
    expect(r.headers.get('content-encoding')).toBe(encoding);
    expect(r.headers.get('content-type')).toContain('model/gltf-binary');
    expect(r.headers.get('vary')).toContain('Accept-Encoding');
    expect(r.headers.get('x-asset-bytes')).toBe(String(content.length));
    expect(Buffer.from(await r.arrayBuffer())).toEqual(content);
  }
});
it('only caches hashed assets or matching model versions immutably and supports 304', async () => {
  const r = await fetch(`${base}/models/court.glb?v=${version}`);
  expect(r.headers.get('cache-control')).toContain('immutable');
  const cached = await new Promise<number | undefined>((resolve, reject) => {
    get(
      `${base}/models/court.glb?v=${version}`,
      {
        headers: { 'If-None-Match': r.headers.get('etag')!, 'Accept-Encoding': 'gzip, deflate' },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    ).on('error', reject);
  });
  expect(cached).toBe(304);
  for (const path of ['/', '/models/court.glb', '/models/court.glb?v=wrong']) {
    const res = await fetch(base + path);
    expect(res.headers.get('cache-control')).not.toContain('immutable');
  }
  expect((await fetch(`${base}/assets/main-abcdefgh.js`)).headers.get('cache-control')).toContain(
    'immutable',
  );
});
it('supports original fallback, byte ranges, HEAD and missing paths', async () => {
  const r = await fetch(`${base}/models/court.glb`, { headers: { 'Accept-Encoding': 'identity' } });
  expect(r.headers.get('content-encoding')).toBeNull();
  expect(Buffer.from(await r.arrayBuffer())).toEqual(content);
  const range = await fetch(`${base}/models/court.glb`, { headers: { Range: 'bytes=0-3' } });
  expect(range.status).toBe(206);
  expect(range.headers.get('content-encoding')).toBeNull();
  const head = await fetch(`${base}/models/court.glb`, {
    method: 'HEAD',
    headers: { 'Accept-Encoding': 'br' },
  });
  expect(head.headers.get('content-encoding')).toBe('br');
  expect((await head.arrayBuffer()).byteLength).toBe(0);
  expect((await fetch(`${base}/missing.glb`)).status).toBe(404);
});
